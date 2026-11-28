# Symbiospec format definitions

Use [version detection and migration](versioning.md) before normal Symbiospec work. The required format for normal work is the latest published entry below, currently `3.1.0`. Retained older definitions support migration sources, not ordinary work on older data. Follow the shared procedure to migrate automatically before normal work. Migration completion follows the shared removal rule: obsolete project paths are removed after preservation and known-reference checks, without redirects or compatibility pages; uneditable external references are reported limitations. This rule governs conversion completion, not a new project-data layout. Skill release versions are independent of project format versions.

Keep one complete definition per published version, named `format-<MAJOR.MINOR.PATCH>.md`. Add each future version to the ordered list below, linking its definition and instructions for the transition from the preceding published version. Keep older definitions available; do not rewrite an old definition to describe a newer format. Publish corrections as patch versions.

- [1.0.0](format-v1.0.0.md): existing specification structure and conventions. Unversioned adoption is defined in [versioning](versioning.md#3-unversioned-adoption); no product-data conversion is needed.

- [2.0.0](format-v2.0.0.md): dated original decision records and maintained topic summaries; [forward and reverse conversion from 1.0.0](migration-1-to-2.md).

- [3.0.0](format-v3.0.0.md): original coverage examinations and maintained topic summaries; [forward and reverse conversion from 2.0.0](migration-2-to-3.md).

- [3.1.0](format-v3.1.0.md): optional human-approved user scenarios; [forward and reverse conversion from 3.0.0](migration-3-to-3.1.md).

The headings below preserve existing links to the former unversioned reference.

## 0. Introduction

### 0.1. Structure

See [3.1.0 structure](format-v3.1.0.md#01-structure).

### 0.2. Responsibilities

See [3.1.0 responsibilities](format-v3.1.0.md#02-responsibilities).

### 0.3. Documents and approval

See [3.1.0 documents and approval](format-v3.1.0.md#03-documents-and-approval).

## 1. Repository structure

See [3.1.0 repository structure](format-v3.1.0.md#1-repository-structure).

## 2. Responsibilities of the six areas

See [3.1.0 area responsibilities](format-v3.1.0.md#2-responsibilities-of-the-six-areas).

### 2.1. Glossary

See [3.1.0 Glossary](format-v3.1.0.md#21-glossary).

### 2.2. Behaviour

See [3.1.0 Behaviour](format-v3.1.0.md#22-behaviour).

### 2.3. User Interface

See [3.1.0 User Interface](format-v3.1.0.md#23-user-interface).

### 2.4. Styling

See [3.1.0 Styling](format-v3.1.0.md#24-styling).

### 2.5. Platform Support

See [3.1.0 Platform Support](format-v3.1.0.md#25-platform-support).

### 2.6. System Overview

See [3.1.0 System Overview](format-v3.1.0.md#26-system-overview).

## 3. Document conventions

See [3.1.0 document conventions](format-v3.1.0.md#3-document-conventions).

## 4. Proposals, decisions, and coverage

See [3.1.0 proposals, decisions, and coverage](format-v3.1.0.md#4-proposals-decisions-and-coverage).

### 4.1. Proposals

See [3.1.0 proposals](format-v3.1.0.md#41-proposals).

### 4.2. Decisions

See [3.1.0 decisions](format-v3.1.0.md#42-decisions).

### 4.3. Coverage

See [3.1.0 coverage](format-v3.1.0.md#43-coverage).

### 4.4. Audit and Realignment reports

See [3.1.0 audit and Realignment reports](format-v3.1.0.md#44-audit-and-realignment-reports).

## 5. User scenarios

See [3.1.0 user scenarios](format-v3.1.0.md#5-user-scenarios).
