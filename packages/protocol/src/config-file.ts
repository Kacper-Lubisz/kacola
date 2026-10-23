// kacola.env (platformPaths().configFile): what the window's "Open config file" starts from. The daemon
// reads the file (packages/daemon/src/config-file.ts); the window only creates it from this and opens it.

export const CONFIG_TEMPLATE = `# kacola — advanced settings
#
# One setting per line, NAME=value. Lines starting with # are ignored: remove the # to use one.
# kacola picks up your changes a few seconds after you save (once nothing is recording).
# This file holds API keys: keep it private.

# --- Questions, answers and notes ----------------------------------------------------------
# Which AI writes answers and notes: anthropic, openai, ollama or none
# KACOLA_LLM_PROVIDER=anthropic
# A specific model (leave unset for the provider's default)
# KACOLA_LLM_MODEL=
# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=
# KACOLA_OLLAMA_URL=http://127.0.0.1:11434

# --- Live decisions ------------------------------------------------------------------------
# Ticks off agenda items during meetings and judges which calendar meetings to record:
# local (on this computer), jev (TypeSafe), openai, anthropic or ollama.
# With a TYPESAFE_API_KEY and no provider set here, Jev is used.
# KACOLA_DECISIONS_PROVIDER=jev
# KACOLA_DECISIONS_MODEL=
# TYPESAFE_API_KEY=

# --- Speakers ------------------------------------------------------------------------------
# Recognise people you have named in earlier meetings by their voice (on this computer only).
# KACOLA_VOICEPRINTS=on
`
