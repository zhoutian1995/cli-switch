

# cli-switch

**Enrutador de capacidades de agentes para CLIs de codificación de IA.**

[![versión de npm](https://img.shields.io/npm/v/cli-switch.svg)](https://www.npmjs.com/package/cli-switch)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Licencia: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)

`cli-switch` es una capa de orquestación de línea de comandos para agentes de codificación de IA. Rutea una tarea al agente correcto, inyecta credenciales de gateway, selecciona niveles de modelo, aísla el entorno del proceso hijo y devuelve texto o salida JSON que scripts y agentes de nivel superior pueden consumir.

Versión actual: `cli-switch@1.0.0`

## Idiomas

- [Español](#español)
- [English](#english)
- [中文](#中文)
- [日本語](#日本語)
- [한국어](#한국어)

---

## Español

### Qué es

Los agentes de codificación modernos son poderosos, pero cada CLI tiene autenticación, indicadores de modelo, variables de entorno, puntos fuertes y modos de fallo diferentes. `cli-switch` añade una capa de enrutamiento sobre estas herramientas:

```text
tarea
  -> detección de intención y capacidades
  -> selección de agente y nivel
  -> inyección de credenciales de gateway
  -> ejecución de proceso hijo en sandbox
  -> resultado en texto o JSON
```

Está diseñado para desarrolladores, scripts de automatización y frameworks de agentes que necesitan una interfaz estable para múltiples agentes de codificación.

### Para qué se puede usar

- Rutea tareas de codificación entre Claude Code y Codex CLI.
- Usa una sola clave de gateway o API de relay autoalojada entre agentes compatibles.
- Reutiliza claves al estilo de OpenRouter sin cambiar la configuración global de cada agente.
- Ejecuta decisiones de enrutamiento en modo simulación (`dry-run`) antes de gastar tokens de modelo.
- Construye flujos de trabajo de agentes de nivel superior que necesitan salidas JSON estables.
- Despliega tareas de revisión, generación de tests, refactorización, explicación, análisis y corrección.
- Mantiene las variables de la sesión principal fuera de los procesos de los agentes hijo.
- Inspecciona la disponibilidad local del agente con diagnósticos y comprobaciones de autenticación.
- Define flujos de trabajo de habilidades reutilizables con plantillas de prompts.
- Ejecuta agentes en worktrees aislados o copias temporales sin tocar el proyecto real.

### Buen ajuste

| Escenario | Por qué `cli-switch` ayuda |
| --- | --- |
| Flujo de trabajo de codificación multiagente | Selecciona Claude Code o Codex por tarea en lugar de codificar una sola herramienta. |
| Relay de LLM autoalojado | Mapea credenciales de relay a variables de entorno nativas del agente automáticamente. |
| Integración de frameworks de agentes | Usa `--json`, `--dry-run` y superficies de comandos estables. |
| Enrutamiento de costes y calidad | Enruta por niveles de modelo `economy`, `standard` o `premium`. |
| Diagnósticos tipo CI | Comprueba entorno, autenticación, modelos, proveedores y especificaciones de tiempo de ejecución desde scripts. |
| Aislamiento de ejecución | Ejecuta agentes en worktrees o copias temporales para proteger el proyecto real. |
| Automatización de habilidades | Define plantillas de tareas reutilizables con `skill run <nombre>`. |

### Estado actual

`cli-switch@1.0.0` — las 5 fases del mapa de ruta están completas. 51 archivos de prueba, 640 pruebas pasando.

Implementado:

- `cli-switch run <tarea>` con enrutamiento inteligente.
- Sobrescritura de agente con `--agent claude-code|codex`.
- Modos de ejecución: `single`, `write_review`, `write_test_fix`, `patch-only`,
  `temp-copy`, `worktree`.
- Enrutamiento por nivel: `economy`, `standard`, `premium`.
- Alias de gateway: `SWITCH_*`, `SWITCH_RELAY_*`, `OPENROUTER_*`.
- Capas de configuración: global `~/.cli-switch/config.yaml` + proyecto
  `.cli-switch.yaml` + indicadores CLI (CLI > proyecto > global > env).
- Comandos de configuración: `config show/set/reset` con claves de punto, coerción de tipos,
  ámbito `--project`/`--global`, salida `--json`.
- Esquemas de validación de salida y validación de diff con reparación automática acotada.
- Aislamiento de ejecución: modo patch-only, copias temporales de proyecto, git worktrees.
- Definiciones de habilidades: locales en `.cli-switch/skills/` y `~/.cli-switch/skills/`
  con comandos `skill list/show/run`.
- Salida JSON para automatización.
- Diagnósticos: `resolve`, `env`, `auth status`, `doctor`, `list`.
- Aislamiento del entorno de proceso y aislamiento de HOME de gateway.
- Construcción completa en TypeScript y conjunto de pruebas automatizado.

Límites conocidos:

- `--strategy balanced|high_quality|low_cost` se acepta pero aún no se implementa como selector de estrategia de costes en tiempo de ejecución.
- La inyección de gateway apunta actualmente a Claude Code y Codex.

### Instalación

```bash
npm install -g cli-switch
```

Verificar:

```bash
cli-switch --version
cli-switch doctor --json
```

Desde el código fuente:

```bash
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
npm install
npm run build
npm link
```

### Inicio rápido

Vista previa de una decisión de enrutamiento:

```bash
cli-switch run "refactorizar el módulo de autenticación" --dry-run
```

Ejecutar con enrutamiento automático:

```bash
cli-switch run "escribir tests para el analizador de pagos"
```

Forzar un agente específico:

```bash
cli-switch run "corregir este error de TypeScript" --agent codex
cli-switch run "revisar este cambio de arquitectura" --agent claude-code
```

Usar un modo de ejecución:

```bash
cli-switch run "implementar validación de inicio de sesión" --execution write_test_fix
cli-switch run "refactorizar con seguridad" --execution worktree
```

### Configuración de Gateway y Relay

Variables preferidas:

```bash
export SWITCH_API_KEY=tu-clave-de-gateway
export SWITCH_BASE_URL=https://tu-relay.example.com/v1
export SWITCH_MODEL_ECONOMY=tu-modelo-economy
export SWITCH_MODEL_STANDARD=tu-modelo-standard
export SWITCH_MODEL_PREMIUM=tu-modelo-premium
```

Alias de relay autoalojado:

```bash
export SWITCH_RELAY_API_KEY=tu-clave-de-relay
export SWITCH_RELAY_BASE_URL=https://tu-relay.example.com/v1
```

Alias compatibles con OpenRouter:

```bash
export OPENROUTER_API_KEY=sk-or-v1-xxx
export OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Prioridad:

```text
SWITCH_* > SWITCH_RELAY_* > OPENROUTER_*
```

Cuando el modo gateway está habilitado:

| Agente | Variables inyectadas | Indicador de modelo |
| --- | --- | --- |
| Claude Code | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` | `--model` |
| Codex CLI | `OPENAI_API_KEY`, `OPENAI_BASE_URL` | `-m` |

### Archivos de configuración

Configuración global: `~/.cli-switch/config.yaml`

```bash
cli-switch config set gateway.base_url https://tu-relay.example.com/v1
cli-switch config set gateway.api_key tu-clave
cli-switch config set gateway.models.economy tu-modelo-economy
cli-switch config set gateway.default_tier standard
cli-switch config show --json
```

Configuración de proyecto: `.cli-switch.yaml` (por repositorio, sobrescribe global)

```bash
cli-switch config set --project gateway.default_tier premium
cli-switch config show
```

Prioridad de configuración: Indicadores CLI > configuración de proyecto > configuración global > variables de entorno.

### Comandos

```bash
cli-switch resolve         # Resolver herramienta/perfil/modelo a una especificación de tiempo de ejecución
cli-switch env             # Inspeccionar entorno y fuentes de configuración
cli-switch auth status     # Comprobar estado de autenticación para una herramienta
cli-switch doctor          # Ejecutar diagnósticos
cli-switch list            # Listar modelos, proveedores y perfiles
cli-switch run             # Rutea y ejecuta un agente de IA
cli-switch config show     # Mostrar configuración fusionada
cli-switch config set      # Establecer un valor de configuración (punto)
cli-switch config reset    # Restablecer un valor de configuración
cli-switch skill list      # Listar habilidades disponibles
cli-switch skill show      # Mostrar detalles de la habilidad
cli-switch skill run       # Ejecutar una habilidad por nombre
cli-switch capabilities    # Mostrar la matriz de capacidades
cli-switch benchmark       # Ejecutar simulaciones de capacidades entre agentes
```

Opciones actuales de `run`:

```text
--mode <mode>        single|orchestrator|handoff|review
--agent <agent>      claude-code|codex
--execution <mode>   single|write_review|write_test_fix|patch_only|temp_copy|worktree
--tier <tier>        economy|standard|premium
--json               salida JSON
--dry-run            mostrar decisión de enrutamiento sin ejecutar
--timeout <segundos>  tiempo de espera del agente, por defecto 120
--reviewer <agent>   agente revisor para modo review
--no-git             omitir guardia Git
--rollback           intentar rollback en caso de fallo
--stream             salida en streaming, por defecto true
--interactive        selección interactiva de agente
--acp                bridge JSON-RPC sobre stdio
```

### Arquitectura

```text
cmd/                  Puntos de entrada de comandos CLI
src/core/router/      Enrutamiento de capacidades y modelos
src/core/gateway/     Configuración de gateway e inyección de env
src/core/dispatcher/  Gestión de procesos de agentes
src/core/sandbox/     Ayudas de aislamiento de entorno y HOME
src/core/strategy/    Motor de modo de ejecución
src/core/config/      Esquema, cargador y precedencia de configuración
src/core/validation/  Validación de salida y pipeline de reparación
src/core/skill/       Definiciones, cargador y ejecutor de habilidades
src/registry/         Agentes, modelos, proveedores y perfiles integrados
schema/               Esquemas JSON de tiempo de ejecución y configuración
test/                 Pruebas unitarias, de contrato, e2e y de estrés
```

### Desarrollo

```bash
npm run build
npm test
npm run smoke
npm run lint
```

Base de verificación:

```text
51 archivos de prueba
640 pruebas pasando
```

### Mapa de ruta — Completado ✅

Las 5 fases planificadas se han entregado:

1. **Cierre de contrato en tiempo de ejecución** — Estricticidad del resolver, preflight de plataforma/binario, inventario de códigos de error.
2. **Cobertura de configuración** — Capas de configuración global/proyecto, `config show/set/reset`.
3. **Validación y reparación de salida** — Esquemas de capacidades, validación de diff, reparación automática acotada.
4. **Aislamiento de ejecución** — Modos patch-only, copia temporal de proyecto, git worktrees.
5. **Base de flujos de trabajo de habilidades** — Definiciones de habilidades locales, `skill run`.

---

## Inglés

### Qué es

Los agentes de codificación modernos son poderosos, pero cada CLI tiene autenticación, indicadores de modelo, variables de entorno, puntos fuertes y modos de fallo diferentes. `cli-switch` añade una capa de enrutamiento sobre estas herramientas:

```text
tarea
  -> detección de intención y capacidades
  -> selección de agente y nivel
  -> inyección de credenciales de gateway
  -> ejecución de proceso hijo en sandbox
  -> resultado en texto o JSON
```

Está diseñado para desarrolladores, scripts de automatización y frameworks de agentes que necesitan una interfaz estable para múltiples agentes de codificación.

### Para qué se puede usar

- Rutea tareas de codificación entre Claude Code y Codex CLI.
- Usa una sola clave de gateway o API de relay autoalojada entre agentes compatibles.
- Reutiliza claves al estilo de OpenRouter sin cambiar la configuración global de cada agente.
- Ejecuta decisiones de enrutamiento en modo simulación (`dry-run`) antes de gastar tokens de modelo.
- Construye flujos de trabajo de agentes de nivel superior que necesitan salidas JSON estables.
- Despliega tareas de revisión, generación de tests, refactorización, explicación, análisis y corrección.
- Mantiene las variables de la sesión principal fuera de los procesos de los agentes hijo.
- Inspecciona la disponibilidad local del agente con diagnósticos y comprobaciones de autenticación.
- Define flujos de trabajo de habilidades reutilizables con plantillas de prompts.
- Ejecuta agentes en worktrees aislados o copias temporales sin tocar el proyecto real.

### Buen ajuste

| Escenario | Por qué `cli-switch` ayuda |
| --- | --- |
| Flujo de trabajo de codificación multiagente | Selecciona Claude Code o Codex por tarea en lugar de codificar una sola herramienta. |
| Relay de LLM autoalojado | Mapea credenciales de relay a variables de entorno nativas del agente automáticamente. |
| Integración de frameworks de agentes | Usa `--json`, `--dry-run` y superficies de comandos estables. |
| Enrutamiento de costes y calidad | Enruta por niveles de modelo `economy`, `standard` o `premium`. |
| Diagnósticos tipo CI | Comprueba entorno, autenticación, modelos, proveedores y especificaciones de tiempo de ejecución desde scripts. |
| Aislamiento de ejecución | Ejecuta agentes en worktrees o copias temporales para proteger el proyecto real. |
| Automatización de habilidades | Define plantillas de tareas reutilizables con `skill run <nombre>`. |

### Estado actual

`cli-switch@1.0.0` — las 5 fases del mapa de ruta están completas. 51 archivos de prueba, 640 pruebas pasando.

Implementado:

- `cli-switch run <tarea>` con enrutamiento inteligente.
- Sobrescritura de agente con `--agent claude-code|codex`.
- Modos de ejecución: `single`, `write_review`, `write_test_fix`, `patch-only`,
  `temp-copy`, `worktree`.
- Enrutamiento por nivel: `economy`, `standard`, `premium`.
- Alias de gateway: `SWITCH_*`, `SWITCH_RELAY_*`, `OPENROUTER_*`.
- Capas de configuración: global `~/.cli-switch/config.yaml` + proyecto
  `.cli-switch.yaml` + indicadores CLI (CLI > proyecto > global > env).
- Comandos de configuración: `config show/set/reset` con claves de punto, coerción de tipos,
  ámbito `--project`/`--global`, salida `--json`.
- Esquemas de validación de salida y validación de diff con reparación automática acotada.
- Aislamiento de ejecución: modo patch-only, copias temporales de proyecto, git worktrees.
- Definiciones de habilidades: locales en `.cli-switch/skills/` y `~/.cli-switch/skills/`
  con comandos `skill list/show/run`.
- Salida JSON para automatización.
- Diagnósticos: `resolve`, `env`, `auth status`, `doctor`, `list`.
- Aislamiento del entorno de proceso y aislamiento de HOME de gateway.
- Construcción completa en TypeScript y conjunto de pruebas automatizado.

Límites conocidos:

- `--strategy balanced|high_quality|low_cost` se acepta pero aún no se implementa como selector de estrategia de costes en tiempo de ejecución.
- La inyección de gateway apunta actualmente a Claude Code y Codex.

### Instalación

```bash
npm install -g cli-switch
```

Verificar:

```bash
cli-switch --version
cli-switch doctor --json
```

Desde el código fuente:

```bash
git clone https://github.com/zhoutian1995/cli-switch.git
cd cli-switch
npm install
npm run build
npm link
```

### Inicio rápido

Vista previa de una decisión de enrutamiento:

```bash
cli-switch run "refactorizar el módulo de autenticación" --dry-run
```

Ejecutar con enrutamiento automático:

```bash
cli-switch run "escribir tests para el analizador de pagos"
```

Forzar un agente específico:

```bash
cli-switch run "corregir este error de TypeScript" --agent codex
cli-switch run "revisar este cambio de arquitectura" --agent claude-code
```

Usar un modo de ejecución:

```bash
cli-switch run "implementar validación de inicio de sesión" --execution write_test_fix
cli-switch run "refactorizar con seguridad" --execution worktree
```

### Configuración de Gateway y Relay

Variables preferidas:

```bash
export SWITCH_API_KEY=tu-clave-de-gateway
export SWITCH_BASE_URL=https://tu-relay.example.com/v1
export SWITCH_MODEL_ECONOMY=tu-modelo-economy
export SWITCH_MODEL_STANDARD=tu-modelo-standard
export SWITCH_MODEL_PREMIUM=tu-modelo-premium
```

Alias de relay autoalojado:

```bash
export SWITCH_RELAY_API_KEY=tu-clave-de-relay
export SWITCH_RELAY_BASE_URL=https://tu-relay.example.com/v1
```

Alias compatibles con OpenRouter:

```bash
export OPENROUTER_API_KEY=sk-or-v1-xxx
export OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Prioridad:

```text
SWITCH_* > SWITCH_RELAY_* > OPENROUTER_*
```

Cuando el modo gateway está habilitado:

| Agente | Variables inyectadas | Indicador de modelo |
| --- | --- | --- |
| Claude Code | `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL` | `--model` |
| Codex CLI | `OPENAI_API_KEY`, `OPENAI_BASE_URL` | `-m` |

### Archivos de configuración

Configuración global: `~/.cli-switch/config.yaml`

```bash
cli-switch config set gateway.base_url https://tu-relay.example.com/v1
cli-switch config set gateway.api_key tu-clave
cli-switch config set gateway.models.economy tu-modelo-economy
cli-switch config set gateway.default_tier standard
cli-switch config show --json
```

Configuración de proyecto: `.cli-switch.yaml` (por repositorio, sobrescribe global)

```bash
cli-switch config set --project gateway.default_tier premium
cli-switch config show
```

Prioridad de configuración: Indicadores CLI > configuración de proyecto > configuración global > variables de entorno.

### Comandos

```bash
cli-switch resolve         # Resolver herramienta/perfil/modelo a una especificación de tiempo de ejecución
cli-switch env             # Inspeccionar entorno y fuentes de configuración
cli-switch auth status     # Comprobar estado de autenticación para una herramienta
cli-switch doctor          # Ejecutar diagnósticos
cli-switch list            # Listar modelos, proveedores y perfiles
cli-switch run             # Rutea y ejecuta un agente de IA
cli-switch config show     # Mostrar configuración fusionada
cli-switch config set      # Establecer un valor de configuración (punto)
cli-switch config reset    # Restablecer un valor de configuración
cli-switch skill list      # Listar habilidades disponibles
cli-switch skill show      # Mostrar detalles de la habilidad
cli-switch skill run       # Ejecutar una habilidad por nombre
cli-switch capabilities    # Mostrar la matriz de capacidades
cli-switch benchmark       # Ejecutar simulaciones de capacidades entre agentes
```

Opciones actuales de `run`:

```text
--mode <mode>        single|orchestrator|handoff|review
--agent <agent>      claude-code|codex
--execution <mode>   single|write_review|write_test_fix|patch_only|temp_copy|worktree
--tier <tier>        economy|standard|premium
--json               salida JSON
--dry-run            mostrar decisión de enrutamiento sin ejecutar
--timeout <segundos>  tiempo de espera del agente, por defecto 120
--reviewer <agent>   agente revisor para modo review
--no-git             omitir guardia Git
--rollback           intentar rollback en caso de fallo
--stream             salida en streaming, por defecto true
--interactive        selección interactiva de agente
--acp                bridge JSON-RPC sobre stdio
```

### Arquitectura

```text
cmd/                  Puntos de entrada de comandos CLI
src/core/router/      Enrutamiento de capacidades y modelos
src/core/gateway/     Configuración de gateway e inyección de env
src/core/dispatcher/  Gestión de procesos de agentes
src/core/sandbox/     Ayudas de aislamiento de entorno y HOME
src/core/strategy/    Motor de modo de ejecución
src/core/config/      Esquema, cargador y precedencia de configuración
src/core/validation/  Validación de salida y pipeline de reparación
src/core/skill/       Definiciones, cargador y ejecutor de habilidades
src/registry/         Agentes, modelos, proveedores y perfiles integrados
schema/               Esquemas JSON de tiempo de ejecución y configuración
test/                 Pruebas unitarias, de contrato, e2e y de estrés
```

### Desarrollo

```bash
npm run build
npm test
npm run smoke
npm run lint
```

Base de verificación:

```text
51 archivos de prueba
640 pruebas pasando
```

### Mapa de ruta — Completado ✅

Las 5 fases planificadas se han entregado:

1. **Cierre de contrato en tiempo de ejecución** — Estricticidad del resolver, preflight de plataforma/binario, inventario de códigos de error.
2. **Cobertura de configuración** — Capas de configuración global/proyecto, `config show/set/reset`.
3. **Validación y reparación de salida** — Esquemas de capacidades, validación de diff, reparación automática acotada.
4. **Aislamiento de ejecución** — Modos patch-only, copia temporal de proyecto, git worktrees.
5. **Base de flujos de trabajo de habilidades** — Definiciones de habilidades locales, `skill run`.

---

## Chino

### Qué es

`cli-switch` es una **capa de enrutamiento de capacidades de agentes** para CLIs de codificación de IA. No es un nuevo modelo ni un reemplazo de Claude Code / Codex CLI, sino una capa de entrada unificada por encima de estas herramientas:

```text
entrada de tarea
  -> identificación de intención y capacidades
  -> selección de agente y nivel de modelo
  -> inyección de credenciales de relay/gateway
  -> ejecución en sandbox de proceso hijo
  -> resultado en texto o JSON
```

El objetivo principal es que los agentes superiores, scripts de automatización o desarrolladores no tengannecesiten preocuparse directamente por "qué agente, qué modelo, qué API Key o qué parámetros de comando debousar para esta tarea". Solo describes la tarea, y `cli-switch` se encarga de enrutarla al ejecutor adecuado.

### Por qué se hizo

Cada vez hay más herramientas de codificación IA, pero sus formas de invocar no son uniformes:

- Herramientas como Claude Code y Codex CLI tienen sus propios métodos de autenticación y variables de entorno.
- Diferentes agentes tienen especialidades distintas (ej. refactoring complejo, generación de tests, corrección de errores, explicación de código).
- Relays autoalojados, OpenRouter o gateways de terceros a menudo requieren mapear la misma API Key a variables nativas diferentes para cada agente.
- Los agentes superiores necesitan salidas JSON estables en lugar de analizar terminales no estructuradas.
- Hacer que los procesos hijo hereden el HOME global y las variables de sesión del usuario容易 causarcausar contaminación de configuración y comportamientos no reproducibles.

`cli-switch` resuelve el problema de "estandarización de llamadas a capacidades agentes": envuelve diferentes CLIs en capacidades unificadas y permite que el sistema elija automáticamente el agente, nivel de modelo y estrategia de ejecución según la tarea.

### Qué puede hacer

- Rutea tareas entre Claude Code y Codex CLI.
- Usa `--agent` para forzar un agente específico.
- Usa `--tier economy|standard|premium` para expresar niveles de coste/calidad.
- Usa `--execution single|write_review|write_test_fix|patch_only|temp_copy|worktree` para expresar el flujo de ejecución.
- Inyecta claves de relay autoalojado u OpenRouter como variables de entorno nativas para Claude/Codex.
- Usa `--dry-run` para ver la decisión de enrutamiento y evitar consumirgastar llamadasllamadas de modelo a ciegas.
- Usa `--json` para integrar con scripts, CI, agentes superiores o sistemas de automatización.
- Cobertura multinivel con configuración global `~/.cli-switch/config.yaml` + proyecto `.cli-switch.yaml`.
- Gestión de configuración con comandos `config show/set/reset`, so para dot-path, coerción de tipos, `--project`/`--global`.
- Pipeline de validación de salida y reparación automática con esquemas de salida y validación de diff.
- Tres modos de ejecución aislados: patch-only, copia temporal de proyecto, git worktree.
- Definiciones de habilidades locales + `skill list/show/run` para flujos reutilizables.
- Aislamiento de procesos de procesos hijo y limpieza de variables de sesión del proceso padre.

### Estado actual

`cli-switch@1.0.0` — 5 fases del mapa de ruta completadas. 51 archivos de prueba, 640 pruebas pasando.

Límites actuales:

- `--strategy balanced|high_quality|low_cost` se acepta y muestra warning, pero aún no actúa como estrategia de costes en tiempo de ejecución.
- La inyección de gateway se centra actualmenteprincipalmente en Claude Code y Codex.

### Instalación e inicio rápido

```bash
npm install -g cli-switch
cli-switch --version
cli-switch doctor --json
```

Ver decisión de enrutamiento:

```bash
cli-switch run "ayúdame a refactorizar el módulo de auth" --dry-run
```

Ejecutar con selección automática de agente:

```bash
cli-switch run "escribir tests para el parser de pagos"
```

Especificar agente:

```bash
cli-switch run "corregir este error de TypeScript" --agent codex
```

Ejecución aislada:

```bash
cli-switch run "refactorizar este módulo" --execution worktree
```

### Archivos de configuración

Configuración global `~/.cli-switch/config.yaml`:

```bash
cli-switch config set gateway.base_url https://tu-relay.example.com/v1
cli-switch config set gateway.api_key tu-clave
cli-switch config set gateway.models.economy tu-modelo-economy
cli-switch config show --json
```

Configuración de proyecto `.cli-switch.yaml` (independiente por repositorio, sobrescribe global):

```bash
cli-switch config set --project gateway.default_tier premium
```

Prioridad: Parámetros CLI > Configur de proyecto > configuración global > variables de entorno.

### Configuración de Relay/Gateway

```bash
export SWITCH_API_KEY=tu-clave-gateway
export SWITCH_BASE_URL=https://tu-relay.example.com/v1
export SWITCH_MODEL_ECONOMY=tu-modelo-economy
export SWITCH_MODEL_STANDARD=tu-modelo-standard
export SWITCH_MODEL_PREMIUM=tu-modelo-premium
```

Prioridad:

```text
SWITCH_* > SWITCH_RELAY_* > OPENROUTER_*
```

### Mapa de ruta — Completado ✅

1. **Cierre de contrato en tiempo de ejecución** — Refuerzo de resolver, verificación previa de plataforma/binario, cierre de códigos de error.
2. **Cobertura de configuración** — Capas global/proyecto, `config show/set/reset`.
3. **Validación y reparación de salida** — Esquemas de salida, validación de diff, reparación automática acotada.
4. **Aislamiento de ejecución** — patch-only, copia temporal, aislamiento de git worktree.
5. **Base de flujos de trabajo de habilidades** — Definiciones locales de Skill, `skill run`.

---

## Japonés

### Qué es

`cli-switch` es un **Agent Capability Router** para CLIs de codificación de IA. No reemplaza Claude Code o Codex CLI, sino que es una capa de ejecución unificada que se coloca sobre ellos.

```text
entrada de tarea
  -> detección de intención y capabilities
  -> selección de agente y tier de modelo
  -> inyección de credenciales de gateway
  -> ejecución en proceso hijo aislado
  -> resultado en texto o JSON
```

El objetivo es permitir que desarrolladores, scripts de automatización y frameworks de agentes superiores invoquen múltiples agentes de codificación de IA desde una única interfaz CLI estable.

### Por qué es necesario

Los CLIs de codificación de IA son potentes, pero en la práctica presentan los siguientes problemas:

- Cada herramienta tiene diferentes métodos de autenticación, variables de entorno y flags de especificación de modelo.
- CadaDiferentes agentes tienen áreas de especialización distintasdiferentes, por lo que se requierenecesita seleccionar según la tarea.
- Al usar relays LLM propios o gateways compatibles con OpenRouter, es necesario convertir la misma Key a variables de entorno nativas de cada CLI.
- En agentes superiores o CI, se necesita una salida JSON estable en lugar de salidas no estructuradas para terminales.

`cli-switch` estandariza esto mediante "Capability Routing".

### Estado actual

`cli-switch@1.0.0` — las 5 fases del roadmap están completas. 51 archivos de prueba, 640 pruebas pasando.

Funciones implementadas:

- `cli-switch run` con enrutamiento inteligente.
- Flags `--agent`, `--tier`, `--execution`.
- 6 modos de ejecución: `single`, `write_review`, `write_test_fix`, `patch_only`, `temp_copy`, `worktree`.
- Capas de configuración global + proyecto, `config show/set/reset`.
- Validación de salida + reparaciónreparación automática de diff.
- Definiciones de habilidades locales + `skill list/show/run`.
- Aislamiento de entorno de proceso hijo.

Limitaciones:

- `--strategy` se acepta, pero aún no funciona como estrategia de costes en runtime.
- El focoinyección de gateway tiene como objetivo principal Claude Code y Codex.

### Mapa de ruta — Completado ✅

1. **Cierre de contrato en tiempo de ejecución** — Mayor strictness del resolver, preflight checks, error-code closure.
2. **Cobertura de configuración** — Configuración global/proyecto, `config show/set/reset`.
3. **Validación y reparación de salida** — capability schema, diff validation, bounded repair.
4. **Aislamiento de ejecución** — modos patch-only, temp copy, worktree.
5. **Base de flujos de trabajo de habilidades** — Definiciones locales de Skill, `skill run`.

---

## Coreano

### Qué es

`cli-switch` es un **Agent Capability Router** para CLIs de codificación de IA. No sustituye a Claude Code o Codex CLI, sino que es una capa de orquestación que proporciona una interfaz de ejecución estable sobre múltiplesmúltiples agentes de codificación.

```text
entrada de tarea
  -> detección de intención y capability
  -> selección de agente y tier de modelo
  -> inyección de credenciales de gateway
  -> ejecución en proceso hijo aislado
  -> resultado en texto o JSON
```

El objetivo es permitir que desarrolladores, scripts de automatización y frameworks de agentes superiores invoquen múltiples CLIs de codificación de IA de manera consistente.

### Estado actual

`cli-switch@1.0.0` — las 5 fases del roadmap completadas. 51 archivos de prueba, 640 pruebas pasando.

Funciones implementadas:

- `cli-switch run` con enrutamiento inteligente.
- Flags `--agent`, `--tier`, `--execution`.
- 6 modos de ejecución: `single`, `write_review`, `write_test_fix`, `patch_only`, `temp_copy`, `worktree`.
- Capas de configuración global + proyecto, `config show/set/reset`.
- Validación de salida + reparación automática de diff.
- Definiciones de habilidades locales + `skill list/show/run`.
- Aislamiento de entorno de procesosproceso hijo.

Limitaciones:

- `--strategy` se acepta como opción, pero aún no funciona como estrategia de costes en runtime.
- La inyección de gateway tiene como objetivo principal Claude Code y Codex.

### Mapa de ruta — Completado ✅

1. **Cierre de contrato en tiempo de ejecución** — Mayor strictness del resolver, preflight checks, error-code closure.
2. **Cobertura de configuración** — Configuración global/proyecto, `config show/set/reset`.
3. **Validación y reparación de salida** — capability schema, diff validation, bounded repair.
4. **Aislamiento de ejecución** — modos patch-only, temp copy, worktree.
5. **Base de flujos de trabajo de habilidades** — Definiciones locales de Skill, `skill run`.

---

## Licencia

MIT
