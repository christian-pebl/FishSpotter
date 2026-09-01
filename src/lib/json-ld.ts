// Shared serializer for application/ld+json structured-data script tags.
// JSON.stringify doesn't escape a closing-script-tag sequence, so a field
// containing one (however unlikely for our own metadata) could otherwise
// break out of the tag; escaping every angle bracket to its \uXXXX form
// keeps the JSON semantically identical while making that impossible.
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}
