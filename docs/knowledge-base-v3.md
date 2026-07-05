# Knowledge Base v3.0

## Overview
Knowledge Base v3.0 is the protected ORBIT newsroom knowledge surface for source browsing, semantic search, favorites, upload staging, and the AI Knowledge Copilot. The current implementation is mock-only and runs entirely on local demo data. It is designed to preserve existing ORBIT dashboard styling while adding a source-aware AI workflow without any backend dependency.

The page is mounted at `/knowledge-base` and remains behind the existing protected route guard in `apps/web/src/App.jsx`.

## File Map

- `apps/web/src/pages/KnowledgeBase.jsx`: page orchestrator, layout composition, collection filters, favorites, search, upload staging, and Copilot wiring.
- `apps/web/src/components/knowledge/AiKnowledgeCopilot.jsx`: Copilot container for chat, actions, confidence, context preview, and citations.
- `apps/web/src/components/knowledge/CopilotChat.jsx`: message thread and question composer.
- `apps/web/src/components/knowledge/CopilotMessage.jsx`: user and assistant message rendering.
- `apps/web/src/components/knowledge/QuickPromptBar.jsx`: one-click prompt shortcuts.
- `apps/web/src/components/knowledge/RagContextPanel.jsx`: retrieved context preview.
- `apps/web/src/components/knowledge/SourceCitationCard.jsx`: citation rendering.
- `apps/web/src/components/knowledge/ConfidenceMeter.jsx`: confidence score display.
- `apps/web/src/components/knowledge/KnowledgeActionMenu.jsx`: command actions for document tasks.
- `apps/web/src/data/knowledgeMock.js`: local mock knowledge corpus, quick prompts, action catalog, upload queue, and activity seeds.
- `apps/web/src/lib/mockRagEngine.js`: local search/retrieval/scoring/citation engine.
- `apps/web/src/hooks/useKnowledgeCopilot.js`: Copilot state, submit flow, command action flow, and activity event emission.

## Component Responsibilities

`KnowledgeBase.jsx`
- Owns selected collection, selected document, favorites, activity log, and upload mock state.
- Derives filtered documents and semantic search results.
- Chooses desktop panel or mobile drawer behavior for the Copilot.
- Keeps `/knowledge-base` page behavior additive and route-safe.

`AiKnowledgeCopilot.jsx`
- Wraps the full Copilot experience.
- Presents the active source, actions, quick prompts, chat, confidence, retrieved context, and citations.
- Exposes a close control only for the mobile drawer variant.

`CopilotChat.jsx`
- Renders the message thread.
- Provides the textarea composer and submit button.
- Supports `Ctrl`/`Cmd` + `Enter` submit.

`CopilotMessage.jsx`
- Renders user and assistant messages with role-specific styling.
- Shows confidence and citation metadata on assistant replies.

`QuickPromptBar.jsx`
- Exposes predefined editor prompts.
- Sends one-click questions into the Copilot hook.

`KnowledgeActionMenu.jsx`
- Hosts the task-oriented commands:
  - Summarize document
  - Explain selected source
  - Generate action items
  - Compare sources
  - Find security risks

`RagContextPanel.jsx`
- Shows the retrieved context chunks returned by the mock engine.
- Provides a visible empty state when nothing matches.

`SourceCitationCard.jsx`
- Shows citation label, locator, quote, reliability, and source title.
- Keeps citations readable as separate cards.

`ConfidenceMeter.jsx`
- Summarizes the retrieval confidence score as a compact meter and label.

`useKnowledgeCopilot.js`
- Holds chat messages, loading state, selected context, citations, and confidence.
- Runs query execution for free-form questions and command actions.
- Emits activity events into the page log.

`mockRagEngine.js`
- Implements deterministic local retrieval and answer generation.
- Never calls backend services.
- Never streams or fabricates live server state.

## Mock RAG Data Flow

1. User opens `/knowledge-base`.
2. `KnowledgeBase.jsx` selects the active document and passes the local corpus into `useKnowledgeCopilot`.
3. The Copilot hook receives a question or command action.
4. `mockRagEngine.js` searches the local document array with a tokenized match.
5. Matching documents are converted into retrieved context records.
6. Citations are built from the matched context.
7. The confidence score is calculated from retrieval quality and citation strength.
8. A mock answer is generated from the local context only.
9. The hook appends user and assistant messages and emits an activity event.
10. The UI renders chat, retrieved context, citations, confidence, and the activity log.

## Security Notes

- No secret, API key, or token is stored in the Copilot code.
- No `dangerouslySetInnerHTML` is used.
- No runtime API request is made by the Copilot flow.
- The page is protected by the existing route guard in `App.jsx`.
- All rendered text comes from local mock data and is treated as plain content.
- The UI shows a clear mock disclaimer to avoid claiming real backend or production RAG behavior.

## Limitations

- Retrieval is token-based and deterministic, not embedding-based.
- Context ranking is heuristic, not semantic vector search.
- Answers are generated from demo rules and local snippets only.
- Citations are mock records, not persistent source documents.
- The mobile drawer is UI-only and does not replace a real app shell modal system.
- There is no real document ingestion, indexing, or persistence layer.

## Manual Test Checklist

1. Open `/knowledge-base`.
2. Confirm the page loads under the protected ORBIT shell.
3. Select a collection and verify the document list filters correctly.
4. Search for a document title or topic and confirm semantic results update.
5. Open a document preview and verify the confidence and metadata panels update.
6. Open the AI Copilot on desktop or mobile.
7. Ask a question about the active document.
8. Run each quick prompt.
9. Run each command action:
   - Summarize document
   - Explain selected source
   - Generate action items
   - Compare sources
   - Find security risks
10. Verify retrieved context appears.
11. Verify citation cards appear when context exists.
12. Verify empty states appear when search returns no match or no context is available.
13. Verify activity entries are added after Copilot actions.
14. Run `npm.cmd run build`.
15. Run `git diff --check`.

## Future Upgrade Path

The current mock flow is structured so it can be replaced with real RAG in stages:

1. FastAPI
   - Move retrieval and answer orchestration into a dedicated service.
   - Keep the ORBIT UI contract stable while the transport changes.

2. PostgreSQL + pgvector
   - Store document chunks and embeddings in PostgreSQL.
   - Use pgvector for semantic retrieval and ranking.

3. Supabase Storage
   - Store uploaded source files and derived artifacts.
   - Keep metadata in the database and binary assets in storage.

4. Embeddings
   - Generate chunk embeddings during ingestion.
   - Use the same embedding model for search and reranking.

5. Streaming AI Response
   - Stream tokens into the Copilot chat UI.
   - Preserve citations and retrieved context as structured metadata.

Recommended migration order:

1. Add a retrieval API contract.
2. Replace mock search with database-backed search.
3. Move file ingestion to storage plus indexing jobs.
4. Add streaming responses last.
