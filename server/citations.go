package main

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	documentCitationPattern  = regexp.MustCompile(`\[Source (\d+)\]`)
	emptyCitationMarkPattern = regexp.MustCompile(`(?i)<mark>\s*</mark>`)
	citationMarkOpenPattern  = regexp.MustCompile(`(?i)<mark\b[^>]*>`)
	citationSpacePattern     = regexp.MustCompile(`(?:[ \t]|&nbsp;)+([，。；：、！？,.!?;:])`)
)

// reconcileDocumentCitations keeps the persisted source list and inline
// citation numbers as one atomic structure. A source remains linked only when
// the document cites it, and sparse numbers are compacted deterministically.
func reconcileDocumentCitations(content string, sourceIDs []string, materialIDs map[string]bool) (string, []string) {
	sourceIDs = normalizeStrings(sourceIDs)
	used := make(map[int]bool, len(sourceIDs))
	for _, match := range documentCitationPattern.FindAllStringSubmatch(content, -1) {
		number, err := strconv.Atoi(match[1])
		if err != nil || number < 1 || number > len(sourceIDs) {
			continue
		}
		if materialIDs != nil && !materialIDs[sourceIDs[number-1]] {
			continue
		}
		used[number] = true
	}

	nextIDs := make([]string, 0, len(used))
	renumber := make(map[int]int, len(used))
	for oldNumber, id := range sourceIDs {
		number := oldNumber + 1
		if !used[number] {
			continue
		}
		nextIDs = append(nextIDs, id)
		renumber[number] = len(nextIDs)
	}

	nextContent := documentCitationPattern.ReplaceAllStringFunc(content, func(value string) string {
		match := documentCitationPattern.FindStringSubmatch(value)
		if len(match) != 2 {
			return ""
		}
		oldNumber, err := strconv.Atoi(match[1])
		if err != nil {
			return ""
		}
		newNumber, ok := renumber[oldNumber]
		if !ok {
			return ""
		}
		return "[Source " + strconv.Itoa(newNumber) + "]"
	})
	nextContent = emptyCitationMarkPattern.ReplaceAllString(nextContent, "")
	nextContent = citationMarkOpenPattern.ReplaceAllString(nextContent, "<mark>")
	nextContent = citationSpacePattern.ReplaceAllString(nextContent, "$1")
	return strings.TrimSpace(nextContent), nextIDs
}
