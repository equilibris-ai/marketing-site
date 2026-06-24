---
description: Add JSDoc comments (without types) to exported functions, classes, and constants whose purpose isn't obvious from the name/signature
argument-hint: <file-path>
---

Read the file at path: $ARGUMENTS

Then add JSDoc comments to exported items **whose purpose isn't already obvious from the name and signature** — match `app/javascript/CLAUDE.md`'s "non-obvious exports have documentation when needed" and the load-bearing-vs-excessive rubric in `.agents/backend/code_style.md` § Comment Density. A well-named `getUserById(id)` needs no JSDoc; a hook with non-obvious behavior or a constant with a non-obvious unit does. Follow these rules:

1. **ONLY consider items with `export` keyword** - skip all private/internal items, and skip exports that are already self-explanatory (don't narrate the obvious)
2. **Do NOT include type annotations** in JSDoc - TypeScript already provides types
3. **Focus on describing WHAT and WHY**, not types
4. **For functions/methods**: Describe what the function does, its purpose, and any important behavior
5. **For React components**: Describe what the component renders and its purpose
6. **For hooks**: Describe what the hook does and what it returns/manages
7. **For constants/variables**: Describe what they represent
8. **For types/interfaces**: Describe what the type represents and when to use it
9. **Keep it concise** - 1-3 lines is usually enough
10. **Use proper JSDoc format** with `/**  */` blocks

Examples of what TO document:

```typescript
/**
 * Manages the message text and automatically updates it based on whitelisting state.
 * Returns the current message value and a setter function.
 */
export const useMessageData = ({ isWhitelistingChecked, isInstagram }) => {
  // implementation
}

/** Props for the SoloModal component */
export interface SoloModalProps {
  shopItem: SocialListening.ShopItem
  onClose: VoidFunction
}

/**
 * Displays a modal for requesting UGC repurpose rights from a single creator.
 * Handles both Instagram and TikTok platforms with different scope options.
 */
export const SoloModal: React.FC<SoloModalProps> = ({ shopItem, onClose }) => {
  // implementation
}

/** Maximum number of retry attempts for failed operations */
export const MAX_RETRIES = 5
```

Examples of what NOT to document (not exported):

```typescript
// ❌ DO NOT document - not exported
const FIELD_MAPPING = { ... }

// ❌ DO NOT document - not exported
interface UseMessageDataProps { ... }

// ❌ DO NOT document - not exported
const helperFunction = () => { ... }
```

After adding JSDoc comments, run the appropriate linter to ensure code quality.
