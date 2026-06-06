---
trigger: always_on
---

# CRITICAL COMPLIANCE: ZERO RECURSIVE FILE SCANNING
1. NEVER run directory discoveries, file searches, or recursive folder tree reads upon task initialization.
2. YOUR TOTAL SOURCE OF TRUTH IS `AGENT.md` AT THE PROJECT ROOT. You must read this file and ONLY this file to understand the architecture, tech stack, and state.
3. DO NOT look inside adjacent source directories unless a specific file path is explicitly requested by the user or mapped in a custom workflow.
4. If you require code context, you MUST ask the user for permission to read a specific file rather than scanning folders on your own.