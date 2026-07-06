import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { LeadIcon } from '../../components/leads/leadIcons';
import { DuplicateWarningModal } from '../../components/leads/DuplicateWarningModal';
import { Button, Select, Table } from '../../components/ui';
import { useAuth } from '../../hooks/useAuth';
import { useDuplicateWarningModal } from '../../hooks/useDuplicateWarningModal';
import { ApiError } from '../../services/api';
import { leadService } from '../../services/leadService';
import type {
  LeadBulkColumnMapping,
  LeadBulkUploadImportResponse,
  LeadBulkUploadParseResponse,
  LeadBulkUploadPreviewResponse,
  LeadImportHistory,
} from '../../types/lead';
import { getLeadsBasePath, getLeadsListPath } from '../../utils/rbac';

type UploadStep = 'upload' | 'mapping' | 'preview' | 'done';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRowStatusClass(row: { is_duplicate: boolean; can_import: boolean; issues: string[] }) {
  if (row.is_duplicate) return 'is-duplicate';
  if (!row.can_import) return 'is-failed';
  return 'is-ready';
}

export function LeadBulkUploadPage() {
  const { user } = useAuth();
  const basePath = user ? getLeadsBasePath(user.role) : '/employee/leads';
  const listPath = user ? getLeadsListPath(user.role) : '/employee/leads/list';

  const [step, setStep] = useState<UploadStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<LeadBulkUploadParseResponse | null>(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [mapping, setMapping] = useState<LeadBulkColumnMapping>({});
  const [preview, setPreview] = useState<LeadBulkUploadPreviewResponse | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importResult, setImportResult] = useState<LeadBulkUploadImportResponse | null>(null);
  const [history, setHistory] = useState<LeadImportHistory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    duplicateConfirmOpen,
    requestDuplicateConfirm,
    closeDuplicateConfirm,
    confirmDuplicate,
  } = useDuplicateWarningModal();

  const activeSheet = useMemo(
    () => parseResult?.sheets.find((sheet) => sheet.name === selectedSheet) ?? null,
    [parseResult, selectedSheet],
  );

  const sheetSelectionRequired = Boolean(parseResult?.requires_sheet_selection && !selectedSheet);

  const loadHistory = async () => {
    try {
      const data = await leadService.listImportHistory();
      setHistory(data);
    } catch {
      setHistory([]);
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const resetWizard = () => {
    setStep('upload');
    setFile(null);
    setParseResult(null);
    setSelectedSheet('');
    setMapping({});
    setPreview(null);
    setSkipDuplicates(true);
    setImportResult(null);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose an Excel file to upload.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await leadService.parseBulkUpload(file);
      setParseResult(result);
      setSelectedSheet(result.requires_sheet_selection ? '' : (result.sheets[0]?.name ?? ''));
      const initialMapping: LeadBulkColumnMapping = {};
      result.system_fields.forEach((field) => {
        initialMapping[field.key] = '';
      });
      setMapping(initialMapping);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to read the uploaded file.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreview = async () => {
    if (!parseResult || !selectedSheet) {
      setError(parseResult?.multiple_sheets_message || 'Please select a sheet to import.');
      return;
    }
    if (!mapping.company_name) {
      setError('Company Name mapping is required.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await leadService.previewBulkUpload({
        upload_id: parseResult.upload_id,
        sheet_name: selectedSheet,
        mapping,
      });
      setPreview(result);
      setStep('preview');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to build import preview.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const runImport = async () => {
    if (!parseResult || !selectedSheet) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await leadService.importBulkUpload({
        upload_id: parseResult.upload_id,
        sheet_name: selectedSheet,
        mapping,
        skip_duplicates: skipDuplicates,
      });
      setImportResult(result);
      setStep('done');
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImport = () => {
    if (!parseResult || !selectedSheet) return;
    if (preview?.summary.duplicate_rows && !skipDuplicates) {
      requestDuplicateConfirm(() => {
        void runImport();
      });
      return;
    }
    void runImport();
  };

  const failedImportRows = importResult?.error_details.filter((item) => item.status === 'failed') ?? [];
  const skippedImportRows = importResult?.error_details.filter((item) => item.status === 'skipped') ?? [];

  return (
    <div className="payroll-page lead-page">
      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <div className="lead-page__title-row">
              <span className="lead-page__title-icon" aria-hidden>
                <LeadIcon />
              </span>
              <div>
                <h2 className="payroll-title">Bulk Lead Upload</h2>
                <p className="payroll-subtitle">
                  Upload Excel, map columns, validate rows, and import leads with decision makers.
                </p>
              </div>
            </div>
          </div>
          <div className="payroll-header__actions">
            <Link className="payroll-back" to={basePath}>
              Dashboard
            </Link>
            <Link className="payroll-back" to={listPath}>
              All Leads
            </Link>
          </div>
        </div>

        <div className="lead-upload-steps" aria-label="Upload progress">
          {(['upload', 'mapping', 'preview', 'done'] as UploadStep[]).map((item, index) => (
            <span
              key={item}
              className={['lead-upload-step', step === item ? 'is-active' : '', ['upload', 'mapping', 'preview', 'done'].indexOf(step) > index ? 'is-complete' : ''].filter(Boolean).join(' ')}
            >
              {index + 1}. {item === 'upload' ? 'Upload' : item === 'mapping' ? 'Map Columns' : item === 'preview' ? 'Preview' : 'Done'}
            </span>
          ))}
        </div>

        {error ? <p className="form-error">{error}</p> : null}

        {step === 'upload' ? (
          <div className="lead-upload-panel">
            <label className="lead-upload-dropzone">
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="lead-upload-dropzone__title">
                {file ? file.name : 'Choose Excel file (.xlsx or .xls, max 5 MB)'}
              </span>
              <span className="lead-upload-dropzone__hint">
                Column order does not matter. You will map fields and preview rows before import.
              </span>
            </label>
            <Button onClick={() => void handleUpload()} disabled={isSubmitting || !file}>
              {isSubmitting ? 'Reading file...' : 'Upload & Continue'}
            </Button>
          </div>
        ) : null}

        {step === 'mapping' && parseResult ? (
          <div className="lead-upload-panel">
            <p className="muted">
              File: <strong>{parseResult.file_name}</strong>
              {activeSheet ? <> · Sheet rows: {activeSheet.total_rows}</> : null}
            </p>

            {parseResult.requires_sheet_selection ? (
              <div className="ui-alert ui-alert--warning lead-upload-sheet-alert">
                {parseResult.multiple_sheets_message}
              </div>
            ) : null}

            <Select
              id="lead_upload_sheet"
              label="Sheet to import"
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              required
            >
              <option value="">Select a sheet</option>
              {parseResult.sheets.map((sheet) => (
                <option key={sheet.name} value={sheet.name}>
                  {sheet.name} ({sheet.total_rows} rows)
                </option>
              ))}
            </Select>

            {activeSheet ? (
              <>
                <div className="lead-upload-mapping">
                  <h4 className="lead-upload-section-title">Map Excel columns to system fields</h4>
                  {parseResult.system_fields.map((field) => (
                    <Select
                      key={field.key}
                      id={`map_${field.key}`}
                      label={`${field.label}${field.required ? ' *' : ''}`}
                      value={mapping[field.key] ?? ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    >
                      <option value="">Do not import</option>
                      {activeSheet.headers.filter(Boolean).map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </Select>
                  ))}
                </div>

                <div className="lead-upload-sample">
                  <h4>First 10 rows from selected sheet</h4>
                  <div className="lead-table-wrap">
                    <Table className="payroll-table lead-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          {activeSheet.headers.map((header, index) => (
                            <th key={`${header}-${index}`}>{header || `Column ${index + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeSheet.preview_rows.map((row) => (
                          <tr key={row.row_number}>
                            <td>{row.row_number}</td>
                            {row.values.map((value, index) => (
                              <td key={`${row.row_number}-${index}`}>{value || '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </>
            ) : null}

            <div className="lead-upload-actions">
              <Button variant="secondary" onClick={resetWizard}>
                Start Over
              </Button>
              <Button
                onClick={() => void handlePreview()}
                disabled={isSubmitting || sheetSelectionRequired || !activeSheet}
              >
                {isSubmitting ? 'Building preview...' : 'Preview Import'}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'preview' && preview ? (
          <div className="lead-upload-panel">
            <p className="muted">
              Sheet: <strong>{preview.sheet_name}</strong> · File: <strong>{preview.file_name}</strong>
            </p>

            <div className="lead-upload-summary">
              <div><span>Total rows</span><strong>{preview.summary.total_rows}</strong></div>
              <div><span>Ready to import</span><strong>{skipDuplicates ? preview.summary.importable_rows : preview.summary.valid_rows}</strong></div>
              <div><span>Missing company</span><strong>{preview.summary.missing_company_rows}</strong></div>
              <div><span>Possible duplicates</span><strong>{preview.summary.duplicate_rows}</strong></div>
              <div><span>Contact issues</span><strong>{preview.summary.contact_issue_rows}</strong></div>
            </div>

            {preview.summary.duplicate_rows > 0 ? (
              <div className="ui-alert ui-alert--info lead-upload-duplicate-note">
                Duplicates are matched by company name + website + your lead ownership.
                They are skipped by default and will not count toward KPI.
              </div>
            ) : null}

            <label className="lead-upload-checkbox">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
              />
              Skip duplicate leads (recommended)
            </label>

            <div className="lead-table-wrap">
              <Table className="payroll-table lead-table lead-upload-preview-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Company</th>
                    <th>Website</th>
                    <th>Country</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Decision Maker</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview_rows.map((row) => (
                    <tr key={row.row_number} className={getRowStatusClass(row)}>
                      <td>{row.row_number}</td>
                      <td>{row.company_name || '—'}</td>
                      <td>{row.website || '—'}</td>
                      <td>{row.country}</td>
                      <td>{row.priority}</td>
                      <td>{row.current_status.replaceAll('_', ' ')}</td>
                      <td>{row.decision_maker_name || '—'}</td>
                      <td>
                        {row.issues.length ? (
                          <span className="lead-upload-issue">{row.issues.join(' · ')}</span>
                        ) : (
                          <span className="lead-upload-ready">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <p className="muted">Showing first 10 mapped rows. Full file is validated on import.</p>

            <div className="lead-upload-actions">
              <Button variant="secondary" onClick={() => setStep('mapping')}>
                Back to Mapping
              </Button>
              <Button onClick={handleImport} disabled={isSubmitting}>
                {isSubmitting ? 'Importing...' : 'Confirm Import'}
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'done' && importResult ? (
          <div className="lead-upload-panel">
            <p className="form-success">{importResult.detail}</p>
            <div className="lead-upload-summary lead-upload-summary--done">
              <div><span>Sheet</span><strong>{importResult.sheet_name}</strong></div>
              <div><span>Total rows</span><strong>{importResult.total_rows}</strong></div>
              <div><span>Imported</span><strong>{importResult.imported_rows}</strong></div>
              <div><span>Skipped</span><strong>{importResult.skipped_rows}</strong></div>
              <div><span>Failed</span><strong>{importResult.failed_rows}</strong></div>
            </div>

            {failedImportRows.length > 0 ? (
              <div className="lead-upload-errors">
                <h4>Failed rows</h4>
                <ul>
                  {failedImportRows.map((item) => (
                    <li key={item.row_number}>
                      Row {item.row_number}: {item.errors.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {skippedImportRows.length > 0 ? (
              <div className="lead-upload-errors lead-upload-errors--skipped">
                <h4>Skipped rows</h4>
                <ul>
                  {skippedImportRows.slice(0, 20).map((item) => (
                    <li key={item.row_number}>
                      Row {item.row_number}: {item.errors.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="lead-upload-actions">
              <Button onClick={resetWizard}>Upload Another File</Button>
              <Link className="payroll-primary-btn" to={listPath}>
                View Imported Leads
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="payroll-card">
        <div className="payroll-header">
          <div className="payroll-header__text">
            <h3 className="payroll-title payroll-title--sm">Import History</h3>
            <p className="payroll-subtitle">Recent bulk uploads and import results</p>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="muted">No bulk imports yet.</p>
        ) : (
          <Table className="payroll-table lead-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Sheet</th>
                <th>Uploaded By</th>
                <th>Date</th>
                <th>Total</th>
                <th>Imported</th>
                <th>Skipped</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.file_name}</td>
                  <td>{item.sheet_name || '—'}</td>
                  <td>{item.uploaded_by_name}</td>
                  <td>{formatDateTime(item.uploaded_at)}</td>
                  <td>{item.total_rows}</td>
                  <td>{item.imported_rows}</td>
                  <td>{item.skipped_rows}</td>
                  <td>{item.failed_rows}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <DuplicateWarningModal
        open={duplicateConfirmOpen}
        onClose={closeDuplicateConfirm}
        onConfirm={confirmDuplicate}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
