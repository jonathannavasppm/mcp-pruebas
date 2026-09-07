import type { ToolResponse } from "../types.js"
import { BranchMismatchError } from "../utils/errors.js"
import { logger } from "../utils/logger.js"
import { checkoutAndPull } from "../services/branchManager.js"

export async function handleBranchMismatch(
  error: BranchMismatchError,
  ctx: { mcpReq?: { elicitInput?: (params: unknown) => Promise<unknown> } }
): Promise<ToolResponse> {
  const { projectPath, currentBranch, expectedBranch } = error.payload

  const message = `El proyecto en "${projectPath}" está en la rama "${currentBranch}" pero la configuración indica "${expectedBranch}". Para auditar la rama correcta necesito cambiar de rama y hacer pull. ¿Autorizas el cambio?`

  logger.info(
    { projectPath, currentBranch, expectedBranch },
    "Requesting user authorization to switch branch"
  )

  if (!ctx.mcpReq?.elicitInput) {
    return {
      content: [
        {
          type: "text",
          text: `${error.message}\n\nEl cliente MCP no soporta solicitudes de autorización automáticas. Por favor cambia manualmente a la rama "${expectedBranch}" con:\n\ngit checkout ${expectedBranch}\ngit pull origin ${expectedBranch}\n\nY vuelve a ejecutar esta herramienta.`,
        },
      ],
      isError: true,
    }
  }

  try {
    const result = (await ctx.mcpReq.elicitInput({
      mode: "form",
      message,
      requestedSchema: {
        type: "object",
        properties: {
          authorize: {
            type: "boolean",
            title: "Sí, autorizo cambiar de rama",
          },
          pullLatest: {
            type: "boolean",
            title: "También hacer pull de los últimos cambios",
          },
        },
        required: ["authorize"],
      },
    })) as {
      action: "accept" | "decline" | "cancel"
      content?: { authorize?: boolean; pullLatest?: boolean }
    }

    if (result.action !== "accept" || !result.content?.authorize) {
      return {
        content: [
          {
            type: "text",
            text: `Cambio de rama no autorizado. El proyecto permanece en "${currentBranch}". Cambia manualmente a "${expectedBranch}" si deseas continuar.`,
          },
        ],
        isError: true,
      }
    }

    if (result.content.pullLatest) {
      const operationResult = await checkoutAndPull(projectPath, expectedBranch)
      return {
        content: [
          {
            type: "text",
            text: `${operationResult.message}\n\nProcediendo con la auditoría...`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `Autorización recibida, pero no se realizó pull. Cambia a "${expectedBranch}" manualmente si aún no lo has hecho y vuelve a ejecutar la herramienta.`,
        },
      ],
      isError: true,
    }
  } catch (elicitError) {
    logger.error(
      {
        error: elicitError instanceof Error ? elicitError.message : elicitError,
      },
      "Elicitation failed"
    )
    return {
      content: [
        {
          type: "text",
          text: `No se pudo solicitar autorización al usuario. ${error.message}\n\nCambia manualmente a la rama "${expectedBranch}" y vuelve a ejecutar esta herramienta.`,
        },
      ],
      isError: true,
    }
  }
}
