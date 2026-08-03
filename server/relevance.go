package main

import (
	"sort"
	"strings"
	"unicode"
)

func relevanceTokens(value string) map[string]bool {
	result := map[string]bool{}
	var word []rune
	flush := func() {
		if len(word) == 0 {
			return
		}
		if len(word) == 1 {
			result[string(word)] = true
		} else if unicode.Is(unicode.Han, word[0]) {
			for index := 0; index < len(word)-1; index++ {
				result[string(word[index:index+2])] = true
			}
		} else {
			result[string(word)] = true
		}
		word = word[:0]
	}
	for _, char := range []rune(strings.ToLower(value)) {
		if unicode.IsLetter(char) || unicode.IsDigit(char) {
			if len(word) > 0 && unicode.Is(unicode.Han, word[0]) != unicode.Is(unicode.Han, char) {
				flush()
			}
			word = append(word, char)
		} else {
			flush()
		}
	}
	flush()
	return result
}

func tokenOverlap(query, value map[string]bool) int {
	score := 0
	for token := range query {
		if value[token] {
			score++
		}
	}
	return score
}

func normalizedMaterialContent(value string) string {
	var result strings.Builder
	pendingSeparator := false
	previousWasHan := false
	hasContent := false
	for _, char := range strings.ToLower(value) {
		if unicode.IsLetter(char) || unicode.IsDigit(char) {
			currentIsHan := unicode.Is(unicode.Han, char)
			if pendingSeparator && hasContent && !previousWasHan && !currentIsHan {
				result.WriteByte(' ')
			}
			result.WriteRune(char)
			hasContent = true
			previousWasHan = currentIsHan
			pendingSeparator = false
		} else if hasContent {
			pendingSeparator = true
		}
	}
	return result.String()
}

func duplicateMaterialContent(left, right string) bool {
	leftNormalized := normalizedMaterialContent(left)
	rightNormalized := normalizedMaterialContent(right)
	return leftNormalized != "" && leftNormalized == rightNormalized
}

// MaterialSearchMatch is a stable, explainable match returned to product search
// surfaces. Match is deliberately product language rather than an implementation
// label: callers can say why a non-body result appeared without exposing search
// infrastructure to the user.
type MaterialSearchMatch struct {
	ID     string `json:"id"`
	Match  string `json:"match"`
	Reason string `json:"reason,omitempty"`
}

// LocalMaterialSearch is the deterministic fallback for material search. It only
// returns a material when one visible field actually matches the query, and keeps
// the particular matching field so the UI never presents a source/tag match as a
// content match.
func (s *Store) LocalMaterialSearch(query, project string, limit int) ([]MaterialSearchMatch, error) {
	if limit <= 0 || strings.TrimSpace(query) == "" {
		return []MaterialSearchMatch{}, nil
	}
	items, err := s.List()
	if err != nil {
		return nil, err
	}
	queryTokens := relevanceTokens(query)
	type candidate struct {
		match   MaterialSearchMatch
		content string
		score   int
		order   int
	}
	candidates := make([]candidate, 0, len(items))
	for index, item := range items {
		if strings.TrimSpace(item.Content) == "" {
			continue
		}
		projectMatch := project != "" && contains(item.Projects, project)
		if project != "" && !projectMatch {
			continue
		}
		contentScore := tokenOverlap(queryTokens, relevanceTokens(item.Content))
		annotationScore := tokenOverlap(queryTokens, relevanceTokens(item.Annotation))
		tagScore := tokenOverlap(queryTokens, relevanceTokens(strings.Join(item.Tags, " ")))
		projectScore := tokenOverlap(queryTokens, relevanceTokens(strings.Join(item.Projects, " ")))
		titleScore := tokenOverlap(queryTokens, relevanceTokens(item.Source.Title))
		domainScore := tokenOverlap(queryTokens, relevanceTokens(item.Source.Domain))
		score := contentScore + annotationScore + 3*tagScore + 3*projectScore + 2*titleScore + domainScore
		if projectMatch {
			score += 4
		}
		if score == 0 {
			continue
		}
		match := MaterialSearchMatch{ID: item.ID, Match: "content"}
		switch {
		case contentScore > 0:
			// The default content match needs no extra line of UI.
		case annotationScore > 0:
			match = MaterialSearchMatch{ID: item.ID, Match: "annotation", Reason: "Matches annotation"}
		case titleScore > 0:
			match = MaterialSearchMatch{ID: item.ID, Match: "source", Reason: "Matches source title"}
		case domainScore > 0:
			match = MaterialSearchMatch{ID: item.ID, Match: "source", Reason: "Matches source"}
		case tagScore > 0:
			match = MaterialSearchMatch{ID: item.ID, Match: "tag", Reason: "Matches tag"}
		case projectScore > 0 || projectMatch:
			match = MaterialSearchMatch{ID: item.ID, Match: "project", Reason: "Matches project"}
		}
		candidates = append(candidates, candidate{match: match, content: item.Content, score: score, order: index})
	}
	sort.SliceStable(candidates, func(i, j int) bool {
		if candidates[i].score == candidates[j].score {
			return candidates[i].order < candidates[j].order
		}
		return candidates[i].score > candidates[j].score
	})
	selected := make([]candidate, 0, min(limit, len(candidates)))
	for _, candidate := range candidates {
		duplicate := false
		for _, existing := range selected {
			if duplicateMaterialContent(candidate.content, existing.content) {
				duplicate = true
				break
			}
		}
		if duplicate {
			continue
		}
		selected = append(selected, candidate)
		if len(selected) == limit {
			break
		}
	}
	matches := make([]MaterialSearchMatch, 0, len(selected))
	for _, candidate := range selected {
		matches = append(matches, candidate.match)
	}
	return matches, nil
}

// RelevantMaterialIDs selects supporting sources without adding another choice
// to the Extension flow. It is deterministic, local, and never changes items.
func (s *Store) RelevantMaterialIDs(query, project string, limit int) ([]string, error) {
	matches, err := s.LocalMaterialSearch(query, project, limit)
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(matches))
	for _, match := range matches {
		ids = append(ids, match.ID)
	}
	return ids, nil
}
