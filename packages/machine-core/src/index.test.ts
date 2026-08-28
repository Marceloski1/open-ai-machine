import { describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as approvalsModule from "./approvals";
import { readState } from "./state";
import {
  machine_approve,
  machine_process_input,
  machine_render_docx,
  machine_write_artifact,
} from "./index";

async function makeProjectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "machine-core-index-"));
}

describe("machine_process_input", () => {
  test("insumo de audio sin transcripcion ni proveedor se marca NEEDS INPUT sin inventar contenido", async () => {
    const projectDir = await makeProjectDir();

    const result = await machine_process_input({
      projectDir,
      inputPath: "inputs/entrevista.mp3",
      content: Buffer.from("fake-audio-bytes"),
      route: "business",
      outputPath: "business/entrevista.md",
    });

    expect(result.needsInput).toBe(true);
    const record = result.state.inputs.find((i) => i.path === "inputs/entrevista.mp3");
    expect(record?.outputPath).toBe("NEEDS INPUT");
  });
});

describe("flujo write -> pending -> approve -> render", () => {
  test("render se rechaza en pending y procede tras approve, alcanzando la verificacion de pandoc", async () => {
    const projectDir = await makeProjectDir();
    const sourcePath = join(projectDir, "business", "proposal.md");
    await mkdir(join(projectDir, "business"), { recursive: true });
    await writeFile(sourcePath, "# Propuesta\n");

    await machine_write_artifact({ projectDir, gate: "proposal" });

    let pendingState = await readState(projectDir);
    expect(pendingState.approvals.proposal?.status).toBe("pending");

    await expect(
      machine_render_docx({
        projectDir,
        gate: "proposal",
        sourcePath,
        outputPath: join(projectDir, "business", "proposal.docx"),
        isAvailable: () => true,
        render: async () => {},
      }),
    ).rejects.toThrow(/proposal/);

    await machine_approve({ projectDir, gate: "proposal" });

    const approvedState = await readState(projectDir);
    expect(approvedState.approvals.proposal?.status).toBe("approved");

    let renderCalled = false;
    const result = await machine_render_docx({
      projectDir,
      gate: "proposal",
      sourcePath,
      outputPath: join(projectDir, "business", "proposal.docx"),
      isAvailable: () => true,
      isTemplateAvailable: () => true,
      render: async () => {
        renderCalled = true;
      },
    });

    expect(renderCalled).toBe(true);
    expect(result.outputPath).toBe(join(projectDir, "business", "proposal.docx"));
  });

  test("render sin Pandoc falla con instruccion de instalacion y no genera .docx", async () => {
    const projectDir = await makeProjectDir();
    await machine_write_artifact({ projectDir, gate: "proposal" });
    await machine_approve({ projectDir, gate: "proposal" });

    const outputPath = join(projectDir, "business", "proposal.docx");

    await expect(
      machine_render_docx({
        projectDir,
        gate: "proposal",
        sourcePath: join(projectDir, "business", "proposal.md"),
        outputPath,
        isAvailable: () => false,
        render: async () => {
          throw new Error("no deberia invocarse sin pandoc");
        },
      }),
    ).rejects.toThrow(/pandoc/i);

    const exists = await Bun.file(outputPath).exists();
    expect(exists).toBe(false);
  });
});

describe("plantilla corporativa", () => {
  test("puerta aprobada y Pandoc presente pero sin templates/reference.docx falla indicando la plantilla y no genera .docx", async () => {
    const projectDir = await makeProjectDir();
    await machine_write_artifact({ projectDir, gate: "proposal" });
    await machine_approve({ projectDir, gate: "proposal" });

    const outputPath = join(projectDir, "business", "proposal.docx");

    await expect(
      machine_render_docx({
        projectDir,
        gate: "proposal",
        sourcePath: join(projectDir, "business", "proposal.md"),
        outputPath,
        isAvailable: () => true,
        render: async () => {
          throw new Error("render no deberia haberse invocado en este escenario");
        },
      }),
    ).rejects.toThrow(/plantilla/i);

    const exists = await Bun.file(outputPath).exists();
    expect(exists).toBe(false);
  });

  test("defaultPandocRender invoca pandoc con --reference-doc=<plantilla>", async () => {
    const cp = await import("node:child_process");
    const spawnSyncSpy = spyOn(cp, "spawnSync").mockReturnValue({
      status: 0,
    } as ReturnType<typeof cp.spawnSync>);

    const projectDir = await makeProjectDir();
    await machine_write_artifact({ projectDir, gate: "proposal" });
    await machine_approve({ projectDir, gate: "proposal" });

    const outputPath = join(projectDir, "business", "proposal.docx");
    const templatePath = join(projectDir, "templates", "reference.docx");

    await machine_render_docx({
      projectDir,
      gate: "proposal",
      sourcePath: join(projectDir, "business", "proposal.md"),
      outputPath,
      isAvailable: () => true,
      templatePath,
      isTemplateAvailable: () => true,
    });

    expect(spawnSyncSpy).toHaveBeenCalledWith(
      "pandoc",
      expect.arrayContaining([`--reference-doc=${templatePath}`]),
      expect.anything(),
    );

    spawnSyncSpy.mockRestore();
  });
});

describe("no recalculo aguas abajo", () => {
  test("machine_render_docx lee la aprobacion existente del estado sin volver a aprobarla ni recalcularla", async () => {
    const projectDir = await makeProjectDir();
    await machine_write_artifact({ projectDir, gate: "proposal" });
    await machine_approve({ projectDir, gate: "proposal" });

    const approveSpy = spyOn(approvalsModule, "approveGate");

    await machine_render_docx({
      projectDir,
      gate: "proposal",
      sourcePath: join(projectDir, "business", "proposal.md"),
      outputPath: join(projectDir, "business", "proposal.docx"),
      isAvailable: () => true,
      isTemplateAvailable: () => true,
      render: async () => {},
    });

    expect(approveSpy).not.toHaveBeenCalled();
    approveSpy.mockRestore();
  });
});

describe("regeneracion invalida aprobaciones aguas abajo", () => {
  test("regenerar el artefacto de proposal (gate aprobado) vuelve a pending las dependientes", async () => {
    const projectDir = await makeProjectDir();
    await machine_write_artifact({ projectDir, gate: "requirements" });
    await machine_approve({ projectDir, gate: "requirements" });
    await machine_write_artifact({ projectDir, gate: "proposal", dependsOn: ["requirements"] });
    await machine_approve({ projectDir, gate: "proposal" });

    let state = await readState(projectDir);
    expect(state.approvals.requirements?.status).toBe("approved");
    expect(state.approvals.proposal?.status).toBe("approved");

    await machine_write_artifact({ projectDir, gate: "requirements" });

    state = await readState(projectDir);
    expect(state.approvals.requirements?.status).toBe("pending");
    expect(state.approvals.proposal?.status).toBe("pending");
  });
});
