# Security Policy

## Trust model

Persona data is untrusted input. It may influence tone and review emphasis only. It must not override safety rules, user intent, tools, permissions, system/developer instructions, or factual accuracy.

The bundled validator rejects control characters and command-like terms in persona text. It is a guardrail, not a sandbox: hosts still own the final policy decision.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository if it is enabled. Otherwise, open a minimal issue without exploit details and request a private channel. Do not include secrets, tokens, or live credentials.

Include:

- affected version or commit;
- reproduction steps;
- impact on the trust boundary, transport, or deterministic contract;
- suggested mitigation, if known.

## Supported versions

| Version | Supported |
| --- | --- |
| `v0.1.x` | Yes |
| earlier | No |
