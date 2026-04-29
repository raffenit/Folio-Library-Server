---
name: "React TypeScript Standards"
activation: "always-on"
---
# React & TS Clean Code Standards
Follow these principles strictly:
- **SOLID - Single Responsibility**: Components should do one thing. If a component exceeds 100 lines, suggest splitting it.
- **Type Safety**: No use of `any`. Prefer `unknown` with type guards or discriminated unions.
- **Hook Best Practices**: Hooks must be at the top level. Custom hooks must be used for any complex logic (keep components as UI-only).
- **Naming**: Use `PascalCase` for components, `camelCase` for functions/variables, and `I` prefix for interfaces only if it helps clarity.