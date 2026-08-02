package main

import (
	"context"
	"errors"
	"testing"
	"time"
)

type stubMaterialClassifier struct {
	decision OrganizationDecision
	err      error
	started  chan struct{}
}

func (s *stubMaterialClassifier) Classify(ctx context.Context, _ Material, _ []ProjectSummary, _ []string) (OrganizationDecision, error) {
	if s.started != nil {
		select {
		case s.started <- struct{}{}:
		default:
		}
		<-ctx.Done()
		return OrganizationDecision{}, ctx.Err()
	}
	return s.decision, s.err
}

func TestOrganizationServiceAppliesHighConfidenceQuietly(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpsertProject("", UpdateProjectInput{Name: "Logue"}); err != nil {
		t.Fatal(err)
	}
	item, err := store.Create(CreateMaterialInput{Kind: "text", Content: "Improve Logue voice input"})
	if err != nil {
		t.Fatal(err)
	}
	service := NewOrganizationService(store, &stubMaterialClassifier{decision: OrganizationDecision{
		Projects: []string{"Logue"}, Tags: []string{"语音输入"}, Confidence: 0.92, Reason: "与 Logue 语音输入直接相关",
	}})
	if err := service.Organize(context.Background(), item.ID); err != nil {
		t.Fatal(err)
	}
	updated, err := store.GetMaterial(item.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(updated.Projects) != 1 || updated.Projects[0] != "Logue" || len(updated.Tags) != 1 || updated.Tags[0] != "语音输入" {
		t.Fatalf("automatic organization was not applied: %#v", updated)
	}
	if updated.Organization == nil || updated.Organization.Status != "organized" || updated.Organization.Confidence != 0.92 || updated.Organization.Reason == "" {
		t.Fatalf("organization evidence was not persisted: %#v", updated.Organization)
	}
}

func TestOrganizationServiceKeepsUncertainResultsAsReviewableSuggestions(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.UpsertProject("", UpdateProjectInput{Name: "Logue"}); err != nil {
		t.Fatal(err)
	}
	item, err := store.Create(CreateMaterialInput{Kind: "selection", Content: "Ambiguous note", Tags: []string{"人工标签"}})
	if err != nil {
		t.Fatal(err)
	}
	service := NewOrganizationService(store, &stubMaterialClassifier{decision: OrganizationDecision{
		Projects: []string{"Logue"}, Tags: []string{"待整理"}, Confidence: 0.54, Reason: "内容同时可能属于其他项目",
	}})
	if err := service.Organize(context.Background(), item.ID); err != nil {
		t.Fatal(err)
	}
	updated, _ := store.GetMaterial(item.ID)
	if updated.Organization == nil || updated.Organization.Status != "needs_review" || updated.Organization.Reason == "" {
		t.Fatalf("uncertain result was not highlighted for review: %#v", updated.Organization)
	}
	if len(updated.Projects) != 0 || len(updated.Tags) != 1 || updated.Tags[0] != "人工标签" {
		t.Fatalf("uncertain automatic suggestion changed real organization: projects=%#v tags=%#v", updated.Projects, updated.Tags)
	}
	if len(updated.Organization.SuggestedProjects) != 1 || updated.Organization.SuggestedProjects[0] != "Logue" || len(updated.Organization.SuggestedTags) != 1 || updated.Organization.SuggestedTags[0] != "待整理" {
		t.Fatalf("uncertain suggestion was not retained for review: %#v", updated.Organization)
	}
}

func TestOrganizationFailureDoesNotLoseMaterial(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	item, err := store.Create(CreateMaterialInput{Kind: "voice", Content: "Saved before classification", Tags: []string{"existing"}})
	if err != nil {
		t.Fatal(err)
	}
	service := NewOrganizationService(store, &stubMaterialClassifier{err: errors.New("upstream unavailable")})
	if err := service.Organize(context.Background(), item.ID); err == nil {
		t.Fatal("expected classification failure")
	}
	updated, err := store.GetMaterial(item.ID)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Content != item.Content || len(updated.Tags) != 1 || updated.Organization == nil || updated.Organization.Status != "needs_review" {
		t.Fatalf("classification failure damaged the saved material: %#v", updated)
	}
}

func TestBackgroundOrganizationSchedulerStopsDeterministically(t *testing.T) {
	store, err := NewStore(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	item, err := store.Create(CreateMaterialInput{Kind: "text", Content: "queued"})
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{}, 1)
	scheduler := NewBackgroundOrganizationScheduler(NewOrganizationService(store, &stubMaterialClassifier{started: started}))
	scheduler.Schedule(item.ID)
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("background organization did not start")
	}
	done := make(chan struct{})
	go func() {
		scheduler.Close()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("scheduler did not cancel and join its worker")
	}
}
