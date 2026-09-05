@AGENTS.md

## Design System

Always read `DESIGN.md` before making any visual or UI decision. Every font,
colour, spacing value, radius and motion rule is defined there.

Two rules that get broken most often:

- **Royal answers *who*, gold answers *how much*.** Judge identity is
  `royal-500 #3B82F6`. Vote weight is `gold-500 #D4AF37`. Never merge them.
- **`CATEGORY_META` in `src/types.ts` is the only canonical category colour map.**
  Any other category colour map in the codebase is a bug.

Do not deviate without explicit user approval. In QA and review, flag any code
that does not match `DESIGN.md`.
