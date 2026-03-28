
CREATE OR REPLACE FUNCTION public.match_memories(
  _user_id uuid,
  _embedding text,
  _match_count int DEFAULT 5,
  _match_threshold float DEFAULT 0.7
)
RETURNS TABLE (id uuid, content text, memory_type text, metadata jsonb, similarity float)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    me.id, me.content, me.memory_type, me.metadata,
    (1 - (me.embedding <=> _embedding::extensions.vector))::float AS similarity
  FROM public.memory_embeddings me
  WHERE me.user_id = _user_id
    AND (1 - (me.embedding <=> _embedding::extensions.vector))::float > _match_threshold
  ORDER BY me.embedding <=> _embedding::extensions.vector
  LIMIT _match_count;
END;
$$;
