# Project Excel MCP

Servidor [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) profesional que recolecta información de múltiples fuentes configurables y la exporta a un archivo Excel, usando una hoja por fuente.

Soporta proyectos de software (vulnerabilidades via `npm audit`, SonarQube, Uptime Robot, Jira) y fuentes deportivas genéricas via HTTP.

## Inicio rápido

Sigue estos pasos para empezar a usar el MCP en menos de 5 minutos.

### 1. Instalar y compilar

```bash
cd /Users/jonathan.navas/Documents/Desarrollo/MCP
npm install
npm run build
```

### 2. Crear configuración

Elige un ejemplo y cópialo como `config.json`:

```bash
# Para proyectos de software (Jira, SonarQube, Uptime Robot, vulnerabilidades)
cp config/config.projects.example.json config/config.json

# Para fútbol (La Liga, Liga Pro)
cp config/config.football.example.json config/config.json

# Para ambos casos
cp config/config.example.json config/config.json
```

Edita `config/config.json` con tus proyectos, rutas y fuentes reales.

### 3. Configurar credenciales

```bash
cp .env.example .env
```

Edita `.env` y completa solo las variables que vayas a usar. Por ejemplo, si usas Jira:

```env
JIRA_API_TOKEN=tu-token
JIRA_EMAIL=tu-email@example.com
JIRA_URL=https://tu-dominio.atlassian.net/
```

### 4. Conectar el cliente MCP

Agrega el servidor a tu cliente MCP. Sustituye las credenciales por las tuyas:

```json
{
  "mcpServers": {
    "project-excel-mcp": {
      "command": "node",
      "args": [
        "/Users/jonathan.navas/Documents/Desarrollo/MCP/dist/index.js"
      ],
      "env": {
        "CONFIG_PATH": "/Users/jonathan.navas/Documents/Desarrollo/MCP/config/config.json",
        "JIRA_API_TOKEN": "tu-token",
        "JIRA_EMAIL": "tu-email@example.com",
        "JIRA_URL": "https://tu-dominio.atlassian.net/",
        "SONARQUBE_API_KEY": "tu-token",
        "UPTIME_ROBOT_API_KEY": "tu-key",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

Reinicia Claude Desktop, Cursor o VS Code para que detecte el servidor.

### 5. Usar el MCP

En el chat de tu agente escribe algo como:

```text
Recolecta el proyecto proyecto-prueba y genera el Excel.
```

El agente llamará a la tool `collect_project`, el servidor recolectará las fuentes habilitadas y creará el Excel en la ruta configurada en `outputFile`.

---

## Tabla de contenidos

1. [Características](#características)
2. [Requisitos](#requisitos)
3. [Instalación rápida](#instalación-rápida)
4. [Arquitectura](#arquitectura)
5. [Configuración](#configuración)
   - [Variables de entorno](#variables-de-entorno)
   - [Archivo `config.json`](#archivo-configjson)
6. [Uso](#uso)
   - [Scripts disponibles](#scripts-disponibles)
   - [Herramientas MCP](#herramientas-mcp)
   - [Ejemplo de invocación manual](#ejemplo-de-invocación-manual)
7. [Configuración del cliente MCP](#configuración-del-cliente-mcp)
   - [Claude Desktop](#claude-desktop)
   - [Cursor](#cursor)
   - [Visual Studio Code](#visual-studio-code)
   - [Devin](#devin)
8. [Fuentes de datos soportadas](#fuentes-de-datos-soportadas)
   - [HTTP genérico](#http-genérico)
   - [Archivo local](#archivo-local)
   - [Análisis de vulnerabilidades](#análisis-de-vulnerabilidades)
   - [SonarQube](#sonarqube)
   - [Uptime Robot](#uptime-robot)
   - [Jira](#jira)
9. [Seguridad](#seguridad)
10. [Tests y calidad de código](#tests-y-calidad-de-código)
11. [Usar una fuente MCP existente en lugar de REST API](#usar-una-fuente-mcp-existente-en-lugar-de-rest-api)
12. [Extensión: agregar una nueva fuente (ejemplo con Sentry)](#extensión-agregar-una-nueva-fuente-ejemplo-con-sentry)
13. [Solución de problemas](#solución-de-problemas)

## Características

- **Arquitectura extensible** basada en conectores.
- **Múltiples proyectos y fuentes**: cada fuente habilitada escribe en su propia pestaña del Excel.
- **Validación robusta** de configuración y argumentos con Zod.
- **Seguridad**: credenciales solo a través de variables de entorno, redacción de secretos en logs y protección contra path traversal.
- **Análisis de vulnerabilidades** de proyectos Node.js con:
  - Tipo de dependencia (`dependency`, `devDependency`, etc.).
  - Versión instalada, versión actual y última versión disponible.
  - Detección de paquetes deprecados.
  - Detección de paquetes sin mantenimiento (>6 meses sin actualización).
  - Vulnerabilidades y severidad asociada.
- **Autorización interactiva**: si el proyecto no está en la rama configurada, el servidor solicita autorización al usuario antes de cambiar de rama.
- **Compatibilidad universal** con cualquier cliente MCP que soporte transporte `stdio` (Claude Desktop, Cursor, VS Code, Devin).
- **Mensaje de despedida** en cada respuesta exitosa: `Muchas gracias vuelva pronto`.

## Requisitos

- Node.js 20 o superior.
- npm 10 o superior.

## Instalación rápida

```bash
# Clonar o ubicarte en el directorio del proyecto
cd /Users/jonathan.navas/Documents/Desarrollo/MCP

# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Copiar configuración de ejemplo
cp config/config.example.json config/config.json
cp .env.example .env

# Editar .env con tus credenciales
```

## Arquitectura

El servidor sigue una arquitectura modular:

```text
src/
  index.ts              # Punto de entrada y transporte stdio
  serverFactory.ts      # Registro de tools MCP
  config/               # Carga y validación de config.json
  connectors/           # Conectores de datos (HTTP, archivo, npm audit, etc.)
  services/             # Lógica de negocio: recolecta y escritura de Excel
  tools/                # Handlers de las tools MCP
  utils/                # Logging, validación de rutas, errores, rate limiting
config/                 # Archivos de configuración de ejemplo
tests/                  # Tests unitarios
dist/                   # Código compilado (generado por npm run build)
```

Flujo de ejecución de una tool:

1. El cliente MCP invoca una tool (por ejemplo, `collect_project`).
2. El servidor valida los argumentos con Zod.
3. Localiza el proyecto y sus fuentes habilitadas en `config.json`.
4. Para cada fuente, resuelve el conector correspondiente y recolecta filas.
5. `excelWriter` crea o actualiza el workbook, generando una hoja por fuente.
6. El servidor devuelve la ruta del archivo Excel y un resumen de filas escritas.

## Configuración

### Variables de entorno

Crea un archivo `.env` a partir de `.env.example`:

```bash
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
# Configuración del servidor
CONFIG_PATH=./config/config.json
LOG_LEVEL=info
NODE_ENV=development

# Fuentes deportivas via HTTP
FOOTBALL_DATA_API_KEY=tu-football-data-api-key
LIGA_PRO_API_KEY=tu-liga-pro-api-key

# SonarQube
SONARQUBE_API_KEY=tu-sonarqube-token

# Uptime Robot
UPTIME_ROBOT_API_KEY=tu-uptime-robot-key

# Jira
JIRA_API_TOKEN=tu-jira-api-token
JIRA_EMAIL=tu-email@example.com
JIRA_URL=https://tu-dominio.atlassian.net/
```

### Archivo `config.json`

Copia el archivo de ejemplo adecuado:

```bash
# Configuración completa (fútbol + proyectos de software)
cp config/config.example.json config/config.json

# Solo fútbol
cp config/config.football.example.json config/config.json

# Solo proyectos de software
cp config/config.projects.example.json config/config.json
```

El archivo `config.json` tiene esta estructura general:

```json
{
  "outputFile": "./output/report.xlsx",
  "projects": [
    {
      "name": "proyecto-prueba",
      "sources": [
        {
          "id": "vulnerabilities",
          "sheetName": "Vulnerabilidades",
          "type": "npm-audit",
          "enabled": true,
          "config": { ... }
        }
      ]
    }
  ]
}
```

| Campo | Descripción |
|-------|-------------|
| `outputFile` | Ruta relativa del archivo Excel de salida. |
| `projects` | Array de proyectos. |
| `projects[].name` | Nombre del proyecto. Se usa como argumento en `collect_project`. |
| `projects[].sources` | Fuentes de datos del proyecto. |
| `sources[].id` | Identificador único de la fuente. |
| `sources[].sheetName` | Nombre de la pestaña en el Excel. |
| `sources[].type` | Tipo de conector (`http`, `file`, `npm-audit`, `sonarqube`, `uptime-robot`, `jira`). |
| `sources[].enabled` | `true` para recolectar la fuente; `false` para omitirla. |
| `sources[].config` | Configuración específica del conector. |

## Uso

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `npm run build` | Compila el proyecto TypeScript a `dist/`. |
| `npm run dev` | Ejecuta el servidor en desarrollo con `tsx`. |
| `npm start` | Ejecuta el servidor compilado. |
| `npm run test` | Ejecuta los tests con Vitest. |
| `npm run format` | Formatea el código con Prettier. |
| `npm run format:check` | Verifica el formato sin modificar archivos. |
| `npm run typecheck` | Verifica tipos de TypeScript sin emitir archivos. |

### Herramientas MCP

| Tool | Propósito |
|------|-----------|
| `collect_project` | Recolecta todas las fuentes habilitadas de un proyecto y escribe el Excel. |
| `collect_source` | Recolecta una sola fuente de un proyecto. |
| `collect_all_projects` | Recolecta todos los proyectos configurados en una sola ejecución. |
| `get_status` | Muestra el estado del servidor, proyectos y fuentes configuradas. |
| `validate_config` | Valida que `config.json` y las variables de entorno requeridas estén correctas. |

### Ejemplo de invocación manual

```bash
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"collect_project","arguments":{"projectName":"proyecto-prueba"}}}' \
  | CONFIG_PATH=./config/config.json node dist/index.js
```

Respuesta esperada (resumida):

```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Project \"proyecto-prueba\" collected successfully.\n{...}\n\nMuchas gracias vuelva pronto"
      }
    ]
  },
  "jsonrpc": "2.0",
  "id": 2
}
```

## Configuración del cliente MCP

Todos los ejemplos usan transporte `stdio` para máxima compatibilidad.

### Claude Desktop

Edita `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "project-excel-mcp": {
      "command": "node",
      "args": [
        "/Users/jonathan.navas/Documents/Desarrollo/MCP/dist/index.js"
      ],
      "env": {
        "CONFIG_PATH": "/Users/jonathan.navas/Documents/Desarrollo/MCP/config/config.json",
        "FOOTBALL_DATA_API_KEY": "...",
        "LIGA_PRO_API_KEY": "...",
        "SONARQUBE_API_KEY": "...",
        "UPTIME_ROBOT_API_KEY": "...",
        "JIRA_API_TOKEN": "...",
        "JIRA_EMAIL": "...",
        "JIRA_URL": "...",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Cursor

Edita `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "project-excel-mcp": {
      "command": "node",
      "args": [
        "/Users/jonathan.navas/Documents/Desarrollo/MCP/dist/index.js"
      ],
      "env": {
        "CONFIG_PATH": "/Users/jonathan.navas/Documents/Desarrollo/MCP/config/config.json",
        "JIRA_API_TOKEN": "...",
        "JIRA_EMAIL": "...",
        "JIRA_URL": "..."
      }
    }
  }
}
```

### Visual Studio Code

Edita `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "project-excel-mcp": {
      "command": "node",
      "args": [
        "/Users/jonathan.navas/Documents/Desarrollo/MCP/dist/index.js"
      ],
      "env": {
        "CONFIG_PATH": "/Users/jonathan.navas/Documents/Desarrollo/MCP/config/config.json",
        "JIRA_API_TOKEN": "...",
        "JIRA_EMAIL": "...",
        "JIRA_URL": "..."
      }
    }
  }
}
```

### Devin

Configura el MCP en `~/.config/devin/mcp_config.json` o en el archivo `mcp.json` del proyecto con el mismo esquema de `command`, `args` y `env`.

## Fuentes de datos soportadas

| Tipo | Descripción | Requiere credenciales |
|------|-------------|-----------------------|
| `http` | Fuente REST genérica (fútbol, APIs propias). | Depende de la URL. |
| `file` | Archivo local JSON o CSV. | No. |
| `npm-audit` | Análisis de vulnerabilidades de un proyecto Node.js. | No. |
| `sonarqube` | Métricas de calidad de SonarQube. | Sí (`SONARQUBE_API_KEY`). |
| `uptime-robot` | Monitores y estado de Uptime Robot. | Sí (`UPTIME_ROBOT_API_KEY`). |
| `jira` | Issues de proyectos Jira. | Sí (`JIRA_API_TOKEN`, `JIRA_EMAIL`, `JIRA_URL`). |

### HTTP genérico

Ideal para APIs deportivas o cualquier servicio REST. Requiere `url`, `method`, `fieldMapping` y opcionalmente `apiKeyEnv` / `apiKeyHeader`.

### Archivo local

Lee archivos JSON o CSV del disco. Útil para fuentes que ya tienes descargadas.

### Análisis de vulnerabilidades

Ejecuta `npm audit` y `npm outdated` en el proyecto configurado. Valida que el repositorio esté en la rama indicada antes de analizar. Si no lo está, solicita autorización al usuario para hacer `git checkout` y `pull`.

### SonarQube

Consulta el endpoint `/api/measures/component` con las métricas configuradas.

### Uptime Robot

Consulta el endpoint `getMonitors` de la API v2. Puedes filtrar por `projectName`.

### Jira

Consulta `/rest/api/3/search` con el JQL configurado. Usa autenticación Basic con email + token.

## Seguridad

- **Credenciales**: las API keys y tokens viven únicamente en variables de entorno. `config.json` nunca contiene valores secretos.
- **Protección de rutas**: el servidor rechaza rutas absolutas y path traversal para `outputFile` y `pathProject`.
- **Sin escritura accidental**: `npm audit` solo lee información. Un cambio de rama solo ocurre si el usuario autoriza explícitamente la operación.
- **Logs seguros**: el logger redacta automáticamente campos como `apiKey`, `token`, `password`, `secret` y `email`.
- **Rate limiting**: limitador simple en memoria para prevenir bucles de invocaciones.

## Tests y calidad de código

```bash
# Ejecutar tests
npm run test

# Verificar tipos
npm run typecheck

# Formatear código
npm run format

# Verificar formato
npm run format:check
```

El proyecto incluye tests unitarios para:

- Validación segura de rutas (`pathResolver`).
- Generación correcta de archivos Excel (`excelWriter`).

## Usar una fuente MCP existente en lugar de REST API

Algunos servicios ya ofrecen su propio servidor MCP (por ejemplo, UptimeRobot). En ese caso tienes dos opciones.

### Opción A: dejar que el cliente orqueste dos MCPs (recomendado)

MCP es un protocolo cliente-servidor. Tu cliente puede conectarse a múltiples servidores MCP al mismo tiempo. Configura el MCP oficial del servicio junto a nuestro `project-excel-mcp`.

Ejemplo para UptimeRobot:

```json
{
  "mcpServers": {
    "project-excel-mcp": {
      "command": "node",
      "args": [
        "/Users/jonathan.navas/Documents/Desarrollo/MCP/dist/index.js"
      ],
      "env": {
        "CONFIG_PATH": "/Users/jonathan.navas/Documents/Desarrollo/MCP/config/config.json"
      }
    },
    "uptimerobot": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "https://mcp.uptimerobot.com/mcp",
        "--header",
        "Authorization: Bearer UPTIMEROBOT_API_TOKEN"
      ]
    }
  }
}
```

Luego, en el chat:

- Pide a `uptimerobot` que liste monitores o detalles de incidentes.
- Pide a `project-excel-mcp` que genere el reporte en Excel.

### Opción B: nuestro MCP sigue usando REST API

Si necesitas que el Excel se genere **automáticamente**, nuestro MCP debe llamar a la REST API del servicio. El conector correspondiente ya hace esto. No existe una forma nativa de que un servidor MCP invoque a otro servidor MCP de manera automática.

| Escenario | Qué usar |
|-----------|----------|
| Consultar datos en tiempo real con lenguaje natural | MCP oficial del servicio (Opción A). |
| Exportar datos automáticamente a Excel | Conector REST dentro de nuestro MCP (Opción B). |
| Ambas cosas | Configura ambos MCPs en el cliente. |

## Extensión: agregar una nueva fuente (ejemplo con Sentry)

Sigue estos pasos para agregar una fuente que no esté soportada de forma nativa.

### Paso 1: decidir si necesitas un conector nuevo

Si la fuente expone una API REST simple y solo necesitas mapear campos, puedes usar el conector `http` existente. Si requiere lógica adicional (paginación, autenticación especial, transformación de datos), crea un conector dedicado.

### Paso 2: crear el conector

Crea `src/connectors/sentryConnector.ts`:

```typescript
import type { Connector, ConnectorContext } from "./base.js"
import type { RowData } from "../types.js"
import type { SourceConfigOutput } from "../config/schema.js"
import { getRequiredEnv } from "../utils/env.js"
import { McpAppError } from "../utils/errors.js"
import { logger } from "../utils/logger.js"

interface SentrySourceConfig {
  baseUrl?: string
  organization: string
  project: string
  apiKeyEnv?: string
}

export class SentryConnector implements Connector {
  constructor(private readonly source: SourceConfigOutput) {
    const cfg = source.config as unknown as SentrySourceConfig
    if (!cfg.organization || !cfg.project) {
      throw new McpAppError(
        `sentry source "${source.id}" requires "organization" and "project"`
      )
    }
  }

  async collect(ctx: ConnectorContext): Promise<RowData[]> {
    const cfg = this.source.config as unknown as SentrySourceConfig
    const baseUrl = (cfg.baseUrl || "https://sentry.io/api/0").replace(/\/$/, "")
    const token = cfg.apiKeyEnv
      ? getRequiredEnv(cfg.apiKeyEnv)
      : getRequiredEnv("SENTRY_AUTH_TOKEN")

    const url = `${baseUrl}/projects/${encodeURIComponent(
      cfg.organization
    )}/${encodeURIComponent(cfg.project)}/issues/?statsPeriod=24h`

    logger.info({ sourceId: ctx.sourceId, url }, "Fetching Sentry issues")

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new McpAppError(
        `Sentry API returned ${response.status}: ${response.statusText}`
      )
    }

    const issues = (await response.json()) as Array<{
      id: string
      title: string
      culprit?: string
      level?: string
      status?: string
      count?: number
      lastSeen?: string
    }>

    return issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      culprit: issue.culprit || null,
      level: issue.level || null,
      status: issue.status || null,
      count: issue.count || 0,
      lastSeen: issue.lastSeen || null,
    }))
  }
}
```

### Paso 3: agregar el tipo al schema

Edita `src/config/schema.ts`:

```typescript
const ALLOWED_SOURCE_TYPES = [
  "http",
  "file",
  "npm-audit",
  "sonarqube",
  "uptime-robot",
  "jira",
  "sentry",
] as const
```

### Paso 4: registrar el conector en la factory

Edita `src/connectors/factory.ts`:

```typescript
import { SentryConnector } from "./sentryConnector.js"

export function createConnector(source: SourceConfigOutput): Connector {
  switch (source.type) {
    // ... casos existentes ...
    case "sentry":
      return new SentryConnector(source)
    default:
      throw new McpAppError(`Unsupported source type: "${source.type}"`)
  }
}
```

### Paso 5: agregar el tipo de fila (opcional)

Edita `src/types.ts`:

```typescript
export interface SentryRow extends RowData {
  id: string
  title: string
  culprit: string | null
  level: string | null
  status: string | null
  count: number
  lastSeen: string | null
}
```

### Paso 6: agregar la fuente en `config.json`

```json
{
  "id": "sentry-issues",
  "sheetName": "Sentry",
  "type": "sentry",
  "enabled": true,
  "config": {
    "organization": "mi-organizacion",
    "project": "my-next-app",
    "apiKeyEnv": "SENTRY_AUTH_TOKEN"
  }
}
```

### Paso 7: configurar la variable de entorno

```env
SENTRY_AUTH_TOKEN=tu-token-de-sentry
```

### Paso 8: recompilar y probar

```bash
npm run build
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"collect_source","arguments":{"projectName":"proyecto-prueba","sourceId":"sentry-issues"}}}' \
  | CONFIG_PATH=./config/config.json node dist/index.js
```

### Consideraciones para el conector de Sentry

- Sentry usa Bearer token. Guarda el token en una variable de entorno.
- Si la lista de issues es grande, agrega paginación usando el header `Link` de la respuesta.
- Si usas Sentry on-premise, configura `baseUrl` a tu instancia.
- Respeta los límites de rate limit de Sentry.

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `Missing required environment variable: ...` | Falta una env var requerida por una fuente. | Revisa `.env` y asegúrate de que la variable esté definida en la configuración del cliente MCP. |
| `Unable to read config file at ...` | No existe `config.json` o `CONFIG_PATH` es incorrecto. | Copia un archivo de ejemplo y verifica `CONFIG_PATH`. |
| `Project ... is currently on branch ...` | La rama actual del repositorio no coincide con la configurada. | Cambia manualmente de rama o autoriza el cambio cuando el servidor lo solicite. |
| `Path traversal detected` | Se intentó escribir o leer fuera del workspace. | Usa rutas relativas dentro del directorio del proyecto. |
| El Excel no contiene datos de una fuente | La fuente tiene `enabled: false` o falló la recolección. | Revisa los logs y asegúrate de que la fuente esté habilitada. |
# mcp-pruebas
