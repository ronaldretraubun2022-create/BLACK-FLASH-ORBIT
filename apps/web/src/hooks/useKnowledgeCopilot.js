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
  const streamRef = useRef(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (streamRef.current) window.clearInterval(streamRef.current);
    },
    [],
  );

  const quickPrompts = useMemo(() => copilotQuickPrompts, []);
  const commandActions = useMemo(() => knowledgeCommandActions, []);
  const selectionContext = useMemo(() => {
    if (!activeDocument) return [];

    return retrieveContext(activeDocument.title, [activeDocument]);
  }, [activeDocument]);

  useEffect(() => {
    if (!activeDocument) {
      setSelectedContext([]);
      setCitations([]);
      setConfidence(0);
      return;
    }

    const nextCitations = buildCitations(selectionContext);

    setSelectedContext(selectionContext);
    setCitations(nextCitations);
    setConfidence(calculateConfidence(selectionContext));
  }, [activeDocument, selectionContext]);

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
      if (streamRef.current) window.clearInterval(streamRef.current);

      timeoutRef.current = window.setTimeout(() => {
        const context = retrieveContext(query, scopedDocuments);
        const nextCitations = buildCitations(context);
        const nextConfidence = calculateConfidence(context);
        const answer = generateMockAnswer(query, context);
        const answerTokens = answer.split(" ");
        const streamMessageId = `assistant-${Date.now()}-${Math.random()
          .toString(16)
          .slice(2)}`;

        setSelectedContext(context);
        setCitations(nextCitations);
        setConfidence(nextConfidence);
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: streamMessageId,
            role: "assistant",
            content: "",
            timestamp: new Date().toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Jayapura",
            }),
            actionId: options.actionId || null,
            citationCount: nextCitations.length,
            confidence: nextConfidence,
            isStreaming: true,
          },
        ]);

        let index = 0;
        streamRef.current = window.setInterval(() => {
          index += 1;

          setMessages((currentMessages) =>
            currentMessages.map((message) => {
              if (message.id !== streamMessageId) return message;

              const nextContent = answerTokens.slice(0, index).join(" ");
              const isComplete = index >= answerTokens.length;

              return {
                ...message,
                content: nextContent,
                isStreaming: !isComplete,
              };
            }),
          );

          if (index >= answerTokens.length) {
            if (streamRef.current) window.clearInterval(streamRef.current);
            streamRef.current = null;
            setIsLoading(false);
          }
        }, 28);

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
