package main

import (
	"strings"
	"sync"
	"time"
)

const cancellationLifetime = 15 * time.Minute

type requestCancellation struct {
	canceled  bool
	captureID string
	updatedAt time.Time
}

// RequestCancellationRegistry only holds short-lived in-flight client intent.
// It never persists user data and lets a late transcription or save observe cancellation.
type RequestCancellationRegistry struct {
	mu       sync.Mutex
	requests map[string]requestCancellation
}

func NewRequestCancellationRegistry() *RequestCancellationRegistry {
	return &RequestCancellationRegistry{requests: map[string]requestCancellation{}}
}

// Cancel returns the capture that has already been created for this request, if any.
func (r *RequestCancellationRegistry) Cancel(requestID string) string {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return ""
	}
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(now)
	record := r.requests[requestID]
	record.canceled = true
	record.updatedAt = now
	r.requests[requestID] = record
	return record.captureID
}

// RegisterCapture binds a persisted audio file to its in-flight request.
// A true return value means the request was already cancelled.
func (r *RequestCancellationRegistry) RegisterCapture(requestID, captureID string) bool {
	requestID = strings.TrimSpace(requestID)
	captureID = strings.TrimSpace(captureID)
	if requestID == "" || captureID == "" {
		return false
	}
	now := time.Now().UTC()
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(now)
	record := r.requests[requestID]
	record.captureID = captureID
	record.updatedAt = now
	r.requests[requestID] = record
	return record.canceled
}

func (r *RequestCancellationRegistry) IsCanceled(requestID string) bool {
	requestID = strings.TrimSpace(requestID)
	if requestID == "" {
		return false
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.pruneLocked(time.Now().UTC())
	return r.requests[requestID].canceled
}

func (r *RequestCancellationRegistry) pruneLocked(now time.Time) {
	for requestID, record := range r.requests {
		if now.Sub(record.updatedAt) > cancellationLifetime {
			delete(r.requests, requestID)
		}
	}
}
