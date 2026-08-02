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

// RelevantMaterialIDs selects supporting sources without adding another choice
// to the Extension flow. It is deterministic, local, and never changes items.
func (s *Store) RelevantMaterialIDs(query, project string, limit int) ([]string, error) {
	if limit <= 0 {
		return []string{}, nil
	}
	items, err := s.List()
	if err != nil {
		return nil, err
	}
	queryTokens := relevanceTokens(query)
	type candidate struct {
		id      string
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
		score := tokenOverlap(queryTokens, relevanceTokens(item.Content))
		score += 3 * tokenOverlap(queryTokens, relevanceTokens(strings.Join(item.Tags, " ")))
		score += 3 * tokenOverlap(queryTokens, relevanceTokens(strings.Join(item.Projects, " ")))
		score += 2 * tokenOverlap(queryTokens, relevanceTokens(item.Source.Title))
		if projectMatch {
			score += 4
		}
		if score == 0 {
			continue
		}
		candidates = append(candidates, candidate{id: item.ID, content: item.Content, score: score, order: index})
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
	ids := make([]string, 0, len(selected))
	for _, candidate := range selected {
		ids = append(ids, candidate.id)
	}
	return ids, nil
}
