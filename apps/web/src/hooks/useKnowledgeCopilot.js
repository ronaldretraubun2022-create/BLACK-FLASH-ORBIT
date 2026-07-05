import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  copilotQuickPrompts,
  knowledgeCommandActions,
} from "../data/knowledgeMock.js";
import {
  buildCitations,
  calculateConfidence,
  generateMockAnswer,
  retrieveContext,
} from "../lib/mockRagEngine.js";

function createMessage(role, content, meta = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    timestamp: new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jayapura",
    }),
    ...meta,
  };
}

function getScopedDocuments(documents, activeDocument, actionId) {
  if (!activeDocument) return documents;
  if (actionId === "compare-sources" || actionId === "find-security-risks") {
    return [activeDocument, ...documents.filter((item) => item.id !== activeDocument.id)];
  }

  return [activeDocument];
}

export function useKnowledgeCopilot({
  activeDocument,
  documents = [],
  onActivity,
} = {}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState([]);
  const [citations, setCitations] = useState([]);
  const [confidence, setConfidence] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const quickPrompts = useMemo(() => copilotQuickPrompts, []);
  const commandActions = useMemo(() => knowledgeCommandActions, []);

  const executeQuery = useCallback(
    (rawQuery, options = {}) => {
      const query = String(rawQuery || "").trim();
      if (!query || isLoading) return;

      const scopedDocuments = options.documents || documents;
      const userLabel = options.userLabel || query;

      setIsLoading(true);
      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage("user", userLabel, {
          actionId: options.actionId || null,
        }),
      ]);

      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);

      timeoutRef.current = window.setTimeout(() => {
        const context = retrieveContext(query, scopedDocuments);
        const nextCitations = buildCitations(context);
        const nextConfidence = calculateConfidence(context);
        const answer = generateMockAnswer(query, context);

        setSelectedContext(context);
        setCitations(nextCitations);
        setConfidence(nextConfidence);
        setMessages((currentMessages) => [
          ...currentMessages,
          createMessage("assistant", answer, {
            actionId: options.actionId || null,
            citationCount: nextCitations.length,
            confidence: nextConfidence,
          }),
        ]);
        setIsLoading(false);

        onActivity?.(
          options.activityTitle || "AI question asked",
          context.length
            ? `${userLabel} returned ${context.length} local context match(es).`
            : `${userLabel} returned no matching local documents.`,
          options.tone || (context.length ? "green" : "maroon"),
        );
      }, 220);
    },
    [documents, isLoading, onActivity],
  );

  const submitQuestion = useCallback(
    (question) => {
      executeQuery(question, {
        activityTitle: "AI question asked",
        tone: "green",
      });
    },
    [executeQuery],
  );

  const runCommandAction = useCallback(
    (action) => {
      if (!action) return;

      const scopedDocuments = getScopedDocuments(
        documents,
        activeDocument,
        action.id,
      );
      const activeTitle = activeDocument?.title || "all knowledge sources";
      const query = `${action.prompt}: ${activeTitle}`;

      executeQuery(query, {
        actionId: action.id,
        activityTitle: `AI action: ${action.label}`,
        documents: scopedDocuments,
        tone: action.tone || "gold",
        userLabel: action.label,
      });
    },
    [activeDocument, documents, executeQuery],
  );

  return {
    citations,
    commandActions,
    confidence,
    isLoading,
    messages,
    quickPrompts,
    runCommandAction,
    selectedContext,
    submitQuestion,
  };
}
