const DEMO_KEY = "scholarship-renewal-demo-v1";
const DEADLINE = "2026-10-30T17:00:00+08:00";
let PROGRAMS = [
  { id: "merit", name: "Merit Scholar", max_gwa: 1.75, min_units: 18, max_failed: 0, max_incomplete: 0, max_dropped: 0, deadline: DEADLINE },
  { id: "community", name: "Community Scholar", max_gwa: 2.25, min_units: 15, max_failed: 0, max_incomplete: 0, max_dropped: 1, deadline: DEADLINE }
];
const SEED = [
  { id: "A01", name: "Mikaela Santos", program: "merit", gwa: 1.75, units: 18, failed: 0, incomplete: 0, dropped: 0, submittedAt: DEADLINE, evidence: "GS-2026-A01.pdf", verification: "verified" },
  { id: "A02", name: "Rafael Dizon", program: "merit", gwa: 1.76, units: 18, failed: 0, incomplete: 0, dropped: 0, submittedAt: "2026-10-29T17:00:00+08:00", evidence: "GS-2026-A02.pdf", verification: "verified" },
  { id: "A03", name: "Andrea Flores", program: "community", gwa: 2.25, units: 15, failed: 0, incomplete: 0, dropped: 1, submittedAt: "2026-10-29T17:00:00+08:00", evidence: "GS-2026-A03.pdf", verification: "verified" },
  { id: "A04", name: "Noel Garcia", program: "community", gwa: 2.25, units: 14, failed: 0, incomplete: 1, dropped: 0, submittedAt: "2026-10-29T17:00:00+08:00", evidence: "GS-2026-A04.pdf", verification: "verified" },
  { id: "A05", name: "Sofia Reyes", program: "merit", gwa: 1.50, units: 18, failed: 1, incomplete: 0, dropped: 0, submittedAt: "2026-10-30T17:01:00+08:00", evidence: "GS-2026-A05.pdf", verification: "verified" },
  { id: "A06", name: "Luis Mendoza", program: "community", gwa: 2.00, units: 15, failed: 0, incomplete: 0, dropped: 0, submittedAt: "2026-10-29T17:00:00+08:00", evidence: "GS-2026-A06.pdf", verification: "pending" }
].map((record, index) => ({
  id: `demo-${record.id}`, studentId: record.id, name: record.name, programId: record.program,
  academicYear: "2026-2027", semester: "1", gwa: record.gwa, units: record.units,
  failed: record.failed, incomplete: record.incomplete, dropped: record.dropped,
  submittedAt: record.submittedAt, evidence: record.evidence, verification: record.verification,
  verificationReason: "", evaluation: null, reasons: [], decision: null, decisionNote: "",
  history: [{ event: "Submission received", actor: record.name, at: record.submittedAt }]
}));

let supabaseClient = null;
let state = { role: "", user: null, records: [], scholars: [], view: "overview", selectedId: null, correctionId: null, selectedSemester: "2026-2027|1", authMode: "login", demo: true };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const program = id => PROGRAMS.find(item => item.id === id) || PROGRAMS[0];
const isStaff = () => state.role === "staff";
const dateLabel = value => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(value));
const shortDate = value => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(new Date(value));
const initials = name => (name || "Scholar").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

function evaluate(record) {
  const policy = program(record.programId);
  const reasons = [];
  if (Number(record.gwa) > policy.max_gwa) reasons.push(`GWA ${Number(record.gwa).toFixed(2)} exceeds the ${policy.max_gwa.toFixed(2)} maximum.`);
  if (Number(record.units) < policy.min_units) reasons.push(`${record.units} enrolled units is below the ${policy.min_units}-unit minimum.`);
  if (Number(record.failed) > policy.max_failed) reasons.push(`${record.failed} failed subject(s); ${policy.max_failed} allowed.`);
  if (Number(record.incomplete) > policy.max_incomplete) reasons.push(`${record.incomplete} incomplete grade(s); ${policy.max_incomplete} allowed.`);
  if (Number(record.dropped) > policy.max_dropped) reasons.push(`${record.dropped} dropped subject(s); ${policy.max_dropped} allowed.`);
  if (new Date(record.submittedAt) > new Date(policy.deadline)) reasons.push("Submission received after the 30 Oct 2026, 5:00 PM Manila deadline.");
  return { status: reasons.length ? "deficiency" : "compliant", reasons };
}

function loadDemo() {
  try {
    const stored = JSON.parse(localStorage.getItem(DEMO_KEY));
    state.records = Array.isArray(stored) ? stored : structuredClone(SEED);
  } catch { state.records = structuredClone(SEED); }
  state.scholars = [...new Map(state.records.map(record => [record.studentId, { studentId: record.studentId, name: record.name, programId: record.programId }])).values()];
  if (!localStorage.getItem(DEMO_KEY)) persistDemo();
}
function persistDemo() { localStorage.setItem(DEMO_KEY, JSON.stringify(state.records)); }
function toast(message, error = false) {
  const node = document.createElement("div"); node.className = `toast${error ? " error" : ""}`; node.textContent = message;
  $("#toast-region").append(node); setTimeout(() => node.remove(), 3200);
}
function getVisibleRecords() {
  if (state.demo && !isStaff()) return state.records.filter(record => record.studentId === "A01");
  return state.records;
}
function badgeFor(record) {
  if (record.decision) return `<span class="status ${record.decision}">${record.decision === "approved" ? "Approved" : "Held"}</span>`;
  if (record.evaluation === "compliant") return '<span class="status compliant">Compliant</span>';
  if (record.evaluation === "deficiency") return '<span class="status deficiency">With Deficiency</span>';
  return `<span class="status ${record.verification}">${record.verification === "pending" ? "Pending verification" : record.verification === "returned" ? "Returned" : "Verified"}</span>`;
}
function tableRows(records) {
  return records.map(record => `<tr data-open-record="${escapeHtml(record.id)}"><td><div class="student-cell"><span class="student-mini">${escapeHtml(initials(record.name))}</span><span><span class="student-name">${escapeHtml(record.name)}</span><span class="student-id">${escapeHtml(record.studentId)}</span></span></div></td><td>${escapeHtml(program(record.programId).name)}</td><td>${escapeHtml(record.academicYear)} · Sem ${escapeHtml(record.semester)}</td><td>${Number(record.gwa).toFixed(2)}</td><td>${badgeFor(record)}</td><td>${escapeHtml(shortDate(record.submittedAt))}</td><td><button class="button quiet small-button" data-open-record="${escapeHtml(record.id)}">Open →</button></td></tr>`).join("");
}
function pageHeader(eyebrow, title, subtitle, action = "") {
  return `<div class="page-head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`;
}
function renderOverview() {
  const availableSemesters = [...new Set(getVisibleRecords().map(item => `${item.academicYear}|${item.semester}`))];
  if (!availableSemesters.includes(state.selectedSemester)) state.selectedSemester = availableSemesters[0] || "2026-2027|1";
  const records = getVisibleRecords().filter(item => `${item.academicYear}|${item.semester}` === state.selectedSemester);
  const assigned = isStaff() ? state.scholars.length : 1;
  const pending = records.filter(item => item.verification === "pending").length;
  const evaluated = records.filter(item => item.evaluation);
  const compliant = evaluated.filter(item => item.evaluation === "compliant").length;
  const deficiency = evaluated.filter(item => item.evaluation === "deficiency").length;
  const action = isStaff() ? '<button class="button primary" data-view="scholars">+ Register scholar</button>' : '<button class="button primary" data-view="new-submission">+ New submission</button>';
  const title = isStaff() ? "Renewal overview" : "Your scholarship";
  const subtitle = isStaff() ? "A clear view of semester submissions and renewal decisions." : "Track your semester submission and renewal progress.";
  const max = Math.max(assigned, 1);
  const ownRecord = isStaff() ? null : records[0];
  const nextStep = isStaff()
    ? pending
      ? `<div class="next-step"><span class="next-step-icon">1</span><div><strong>${pending} submission${pending === 1 ? "" : "s"} need verification</strong><span>Open the queue to verify evidence or return it with a reason.</span></div><button class="button primary small-button" data-queue="pending">Review pending →</button></div>`
      : `<div class="next-step"><span class="next-step-icon">✓</span><div><strong>Verification queue is clear</strong><span>Open submissions to evaluate verified records and record renewal decisions.</span></div><button class="button secondary small-button" data-view="submissions">View submissions →</button></div>`
    : ownRecord
      ? `<div class="next-step"><span class="next-step-icon">${ownRecord.verification === "returned" ? "!" : ownRecord.decision ? "✓" : "1"}</span><div><strong>${ownRecord.verification === "returned" ? "Correction requested" : ownRecord.decision ? `Renewal ${ownRecord.decision}` : ownRecord.evaluation ? (ownRecord.evaluation === "compliant" ? "Compliant evaluation" : "With deficiency") : ownRecord.verification === "pending" ? "Submission received" : "Evidence verified"}</strong><span>${ownRecord.verification === "returned" ? "Open the record to correct and resubmit." : ownRecord.decision ? "Your latest renewal decision is recorded." : ownRecord.verification === "pending" ? "Scholarship Staff will verify your evidence." : ownRecord.evaluation ? "Check the record for policy results and next steps." : "Staff verified the evidence; evaluation is next."}</span></div><button class="button secondary small-button" data-open-record="${escapeHtml(ownRecord.id)}">View status →</button></div>`
      : `<div class="next-step"><span class="next-step-icon">1</span><div><strong>Submit your semester summary</strong><span>Enter your grades summary and grade-document reference.</span></div><button class="button primary small-button" data-view="new-submission">Start submission →</button></div>`;
  return `${pageHeader("ACADEMIC YEAR 2026–2027 / SEMESTER 1", title, subtitle, action)}
    ${nextStep}
    <div class="metrics">
      ${metric("Assigned scholars", assigned, isStaff() ? "Across active program records" : "Your current assignment", "♧")}
      ${metric("Pending verification", pending, "Evidence awaiting staff review", "◷")}
      ${metric("Compliant", compliant, "Verified submissions meeting policy", "✓")}
      ${metric("With deficiency", deficiency, "Verified submissions needing review", "!")}
    </div>
    <div class="overview-grid">
      <section class="panel"><div class="panel-head"><div><h2>Semester progress</h2><p>Submission and review status for the selected semester</p></div><select class="semester-select" id="overview-semester">${availableSemesters.map(key => { const [year, semester] = key.split("|"); return `<option value="${escapeHtml(key)}" ${key === state.selectedSemester ? "selected" : ""}>${escapeHtml(year.replace("-", "–"))} · Semester ${escapeHtml(semester)}</option>`; }).join("")}</select></div><div class="panel-body"><div class="progress-list">
        ${progressRow("Assigned", assigned, max, "")}${progressRow("Pending verification", pending, max, "orange")}${progressRow("Compliant", compliant, max, "")}${progressRow("With deficiency", deficiency, max, "red")}
      </div></div></section>
      <section class="panel"><div class="panel-head"><div><h2>Policy at a glance</h2><p>Persisted program thresholds</p></div><button class="text-button" data-view="policy">View policies →</button></div><div class="panel-body"><div class="policy-list">${PROGRAMS.map(item => `<div class="policy-card"><div class="policy-top"><div><h3>${escapeHtml(item.name)}</h3><p>Renewal requirements</p></div><span class="status verified">Active</span></div><div class="policy-values"><div><small>MAXIMUM GWA</small><strong>${item.max_gwa.toFixed(2)}</strong></div><div><small>MINIMUM UNITS</small><strong>${item.min_units}</strong></div><div><small>MAX DROPPED</small><strong>${item.max_dropped}</strong></div></div></div>`).join("")}</div></div></section>
    </div>
    <section class="panel table-panel"><div class="panel-head"><div><h2>${isStaff() ? "Recent submissions" : "Your submission"}</h2><p>${isStaff() ? "Latest activity across assigned scholars" : "Your recorded semester summary"}</p></div><button class="text-button" data-view="submissions">All submissions →</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Scholar</th><th>Program</th><th>Semester</th><th>GWA</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>${tableRows(records.slice(0, 6)) || `<tr><td colspan="7"><div class="empty-state"><strong>No submissions yet</strong>Start by recording your academic summary.</div></td></tr>`}</tbody></table></div></section>`;
}
function metric(label, value, foot, icon) { return `<article class="metric"><div class="metric-label">${label}<span class="metric-icon">${icon}</span></div><strong class="metric-value">${value}</strong><div class="metric-foot">${foot}</div></article>`; }
function progressRow(label, value, max, color) { const width = max ? Math.min(100, Math.round(value / max * 100)) : 0; return `<div class="progress-row"><label>${label}</label><div class="progress-track"><div class="progress-fill ${color}" style="width:${width}%"></div></div><b>${value}</b></div>`; }
function renderSubmissions() {
  const allRecords = getVisibleRecords();
  const records = state.submissionStatusFilter ? allRecords.filter(record => matchesStatus(record, state.submissionStatusFilter)) : allRecords;
  return `${pageHeader("RECORDS / SEMESTER 1", "Submissions", "Review evidence, evaluate policy checks, and record renewal decisions.", isStaff() ? "" : '<button class="button primary" data-view="new-submission">+ New submission</button>')}
    <section class="panel"><div class="panel-head"><div><h2>Semester records</h2><p>${records.length} submission${records.length === 1 ? "" : "s"} visible</p></div><div class="search-tools">${isStaff() ? `<input id="record-search" class="search-input" placeholder="Search name or student ID" aria-label="Search name or student ID"><select id="program-filter" class="filter-select"><option value="">All programs</option><option value="merit">Merit Scholar</option><option value="community">Community Scholar</option></select><select id="status-filter" class="filter-select"><option value="" ${!state.submissionStatusFilter ? "selected" : ""}>All workflow status</option><option value="pending" ${state.submissionStatusFilter === "pending" ? "selected" : ""}>Pending verification</option><option value="returned" ${state.submissionStatusFilter === "returned" ? "selected" : ""}>Returned</option><option value="verified" ${state.submissionStatusFilter === "verified" ? "selected" : ""}>Verified, not evaluated</option><option value="compliant" ${state.submissionStatusFilter === "compliant" ? "selected" : ""}>Compliant</option><option value="deficiency" ${state.submissionStatusFilter === "deficiency" ? "selected" : ""}>With deficiency</option><option value="approved" ${state.submissionStatusFilter === "approved" ? "selected" : ""}>Approved</option><option value="held" ${state.submissionStatusFilter === "held" ? "selected" : ""}>Held</option></select>` : ""}</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Scholar</th><th>Program</th><th>Semester</th><th>GWA</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody id="submissions-body">${tableRows(records) || `<tr><td colspan="7"><div class="empty-state"><strong>No matching records</strong>Try a different search or filter.</div></td></tr>`}</tbody></table></div></section>`;
}
function matchesStatus(record, status) {
  if (status === "pending") return record.verification === "pending";
  if (status === "returned") return record.verification === "returned";
  if (status === "verified") return record.verification === "verified" && !record.evaluation;
  if (status === "approved" || status === "held") return record.decision === status;
  return record.evaluation === status;
}
function renderPolicy() {
  return `${pageHeader("REFERENCE / PROGRAM RULES", "Policy records", "Renewal thresholds are attached to each program and used during evaluation.")}
    <div class="policy-list">${PROGRAMS.map(item => `<section class="policy-card"><div class="policy-top"><div><h3>${escapeHtml(item.name)}</h3><p>Effective for academic year 2026–2027 · Semester 1</p></div><span class="status verified">Persisted policy</span></div><div class="policy-values"><div><small>MAXIMUM PERMITTED GWA</small><strong>${item.max_gwa.toFixed(2)}</strong></div><div><small>MINIMUM ENROLLED UNITS</small><strong>${item.min_units} units</strong></div><div><small>FAILED SUBJECTS</small><strong>${item.max_failed} allowed</strong></div><div><small>INCOMPLETE GRADES</small><strong>${item.max_incomplete} allowed</strong></div><div><small>DROPPED SUBJECTS</small><strong>${item.max_dropped} allowed</strong></div><div><small>SUBMISSION DEADLINE</small><strong>30 Oct · 5:00 PM</strong></div></div><p class="eyebrow" style="margin-top:15px">REQUIRED EVIDENCE: GRADE DOCUMENT REFERENCE</p></section>`).join("")}</div>
    <div class="callout" style="margin-top:14px">Grading scale: 1.00 is best, 3.00 passing, 5.00 failing. Submission exactly at the deadline is on time. Deadline is interpreted in Asia/Manila time.</div>`;
}
function renderScholars() {
  return `${pageHeader("ASSIGNMENTS / STAFF", "Scholar directory", "Register a scholar and assign one of the persisted renewal policies.", '<button class="button primary" data-view="register-scholar">+ Register scholar</button>')}
  <section class="panel table-panel"><div class="panel-head"><div><h2>Assigned scholars</h2><p>${state.scholars.length} scholar account${state.scholars.length === 1 ? "" : "s"}</p></div><div class="search-tools"><input id="scholar-search" class="search-input" placeholder="Search name or student ID" aria-label="Search scholars"><select id="scholar-program-filter" class="filter-select"><option value="">All programs</option><option value="merit">Merit Scholar</option><option value="community">Community Scholar</option></select></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Scholar</th><th>Program</th><th>Semester record</th><th>Verification</th><th>Renewal</th><th></th></tr></thead><tbody id="scholars-body">${scholarRows(state.scholars)}</tbody></table></div></section>
  <p class="callout" style="margin-top:14px">In live mode, use this form to assign a registered Auth user by email. The application never creates account passwords.</p>`;
}
function renderSubmissionForm(record = null) {
  const isCorrection = record?.verification === "returned";
  const actionLabel = isCorrection ? "Resubmit corrected record" : "Submit academic summary";
  return `${pageHeader(isCorrection ? "CORRECTION / RESUBMISSION" : "NEW RECORD / SCHOLAR", isCorrection ? "Correct your submission" : "Academic summary", isCorrection ? "Update the requested fields; your revised record returns to verification." : "Enter your semester totals and add the reference to your grade document.")}
  ${record?.verificationReason ? `<div class="callout" style="margin-bottom:14px">Staff requested a correction: ${escapeHtml(record.verificationReason)}</div>` : ""}
  <div class="record-layout"><form id="submission-form" class="panel form-panel"><h2>${isCorrection ? "Corrected semester information" : "Semester details"}</h2><p>All counts must be whole numbers of zero or more. GWA must be 1.00–5.00.</p>
    <div class="form-grid"><label class="form-field"><span class="field-label">Academic year</span><select class="form-control" name="academicYear" required><option value="2026-2027">2026–2027</option></select></label><label class="form-field"><span class="field-label">Semester</span><select class="form-control" name="semester" required><option value="1">Semester 1</option><option value="2">Semester 2</option></select></label>
    ${isStaff() ? `<label class="form-field"><span class="field-label">Program</span><select class="form-control" name="programId" required>${PROGRAMS.map(item => `<option value="${item.id}" ${record?.programId === item.id ? "selected" : ""}>${item.name}</option>`).join("")}</select></label>` : `<label class="form-field"><span class="field-label">Assigned program</span><div class="assigned-program">${escapeHtml(program(state.user?.programId || record?.programId).name)}</div><input type="hidden" name="programId" value="${escapeHtml(state.user?.programId || record?.programId || "")}"></label>`}
    ${isStaff() ? `<label class="form-field"><span class="field-label">Scholar ID</span><input class="form-control" name="studentId" value="${escapeHtml(record?.studentId || "")}" required pattern="[A-Za-z0-9-]+" placeholder="e.g. A07"></label>` : ""}
    <label class="form-field"><span class="field-label">GWA</span><input class="form-control" name="gwa" type="number" min="1" max="5" step="0.01" required value="${record?.gwa ?? ""}" placeholder="e.g. 1.75"></label><label class="form-field"><span class="field-label">Enrolled units</span><input class="form-control" name="units" type="number" min="0" step="1" required value="${record?.units ?? ""}" placeholder="e.g. 18"></label>
    <label class="form-field"><span class="field-label">Failed subjects</span><input class="form-control" name="failed" type="number" min="0" step="1" required value="${record?.failed ?? 0}"></label><label class="form-field"><span class="field-label">Incomplete grades</span><input class="form-control" name="incomplete" type="number" min="0" step="1" required value="${record?.incomplete ?? 0}"></label><label class="form-field"><span class="field-label">Dropped subjects</span><input class="form-control" name="dropped" type="number" min="0" step="1" required value="${record?.dropped ?? 0}"></label>
    <label class="form-field full"><span class="field-label">Grade document reference</span><input class="form-control" name="evidence" required maxlength="240" value="${escapeHtml(record?.evidence || "")}" placeholder="Registrar file reference or secure document link"><small>Provide a reference only. The Registrar remains the official grade source.</small></label></div>
    <div class="form-actions"><button type="button" class="button quiet" data-view="overview">Cancel</button><button class="button primary" type="submit">${actionLabel} <span>→</span></button></div></form>
    <aside class="panel form-panel"><h2>Before you submit</h2><p>Your record will be checked against your assigned program.</p><div class="policy-values" style="grid-template-columns:1fr 1fr"><div><small>MAX GWA</small><strong>${program(record?.programId || "merit").max_gwa.toFixed(2)}</strong></div><div><small>MIN UNITS</small><strong>${program(record?.programId || "merit").min_units}</strong></div></div><div class="callout" style="margin-top:15px">Evidence must be verified by Scholarship Staff before compliance evaluation. Deadline: 30 Oct 2026, 5:00 PM Manila time.</div></aside></div>`;
}
function renderRegisterScholar() {
  return `${pageHeader("STAFF / ASSIGNMENTS", "Register scholar", "Connect a registered Supabase account to a student ID and policy record.")}
  <div class="record-layout"><form id="register-form" class="panel form-panel"><h2>Scholar assignment</h2><p>The scholar must already have an account in Supabase Auth. No password is created here.</p><div class="form-grid"><label class="form-field full"><span class="field-label">Scholar email</span><input class="form-control" name="email" type="email" required placeholder="scholar@example.edu"></label><label class="form-field"><span class="field-label">Student ID</span><input class="form-control" name="studentId" required pattern="[A-Za-z0-9-]+" placeholder="A07"></label><label class="form-field"><span class="field-label">Display name</span><input class="form-control" name="name" required placeholder="Scholar full name"></label><label class="form-field full"><span class="field-label">Scholarship program</span><select class="form-control" name="programId" required><option value="merit">Merit Scholar</option><option value="community">Community Scholar</option></select></label></div><div class="form-actions"><button type="button" class="button quiet" data-view="scholars">Cancel</button><button class="button primary" type="submit">Save assignment →</button></div></form><aside class="panel form-panel"><h2>Account setup</h2><p>For live use, invite or create the synthetic scholar account through Supabase Auth first, then register its email here. Assign the staff role from the SQL admin setup instructions.</p></aside></div>`;
}
function renderDetail(record) {
  const evalResult = record.evaluation ? { status: record.evaluation, reasons: record.reasons || [] } : null;
  const checks = evalResult ? [
    [`GWA ${Number(record.gwa).toFixed(2)} ≤ ${program(record.programId).max_gwa.toFixed(2)}`, Number(record.gwa) <= program(record.programId).max_gwa],
    [`Enrolled units ≥ ${program(record.programId).min_units}`, Number(record.units) >= program(record.programId).min_units],
    [`Failed subjects ≤ ${program(record.programId).max_failed}`, Number(record.failed) <= program(record.programId).max_failed],
    [`Incomplete grades ≤ ${program(record.programId).max_incomplete}`, Number(record.incomplete) <= program(record.programId).max_incomplete],
    [`Dropped subjects ≤ ${program(record.programId).max_dropped}`, Number(record.dropped) <= program(record.programId).max_dropped],
    [new Date(record.submittedAt) <= new Date(program(record.programId).deadline) ? "Submitted by deadline" : "Submitted after deadline", new Date(record.submittedAt) <= new Date(program(record.programId).deadline)]
  ] : [];
  let actions = "";
  if (isStaff() && record.verification === "pending") actions = `<button class="button primary" data-verify="verified">Verify evidence</button><button class="button danger-button" data-verify="returned">Return for correction</button>`;
  else if (isStaff() && record.verification === "verified" && !record.evaluation) actions = '<button class="button primary" data-evaluate>Evaluate compliance →</button>';
  else if (isStaff() && record.evaluation && !record.decision) actions = `<button class="button primary" data-decision="approved" ${record.evaluation !== "compliant" ? "disabled title=\"Approval requires compliant evaluation\"" : ""}>Approve renewal</button><button class="button secondary" data-decision="held">Hold renewal</button>`;
  else if (!isStaff() && record.verification === "returned") actions = '<button class="button primary" data-correct>Correct and resubmit →</button>';
  const titleStatus = badgeFor(record);
  return `${pageHeader(`RECORD DETAIL / ${escapeHtml(record.studentId)}`, `<span class="detail-head"><button class="back-button" data-view="submissions" aria-label="Back to submissions">←</button>${escapeHtml(record.name)}</span>`, `${escapeHtml(record.studentId)} · ${escapeHtml(program(record.programId).name)} · Academic year ${escapeHtml(record.academicYear)} Semester ${escapeHtml(record.semester)}`)}
  <div class="detail-grid"><div><section class="panel"><div class="panel-head"><div><h2>Academic summary</h2><p>Submitted ${escapeHtml(dateLabel(record.submittedAt))}</p></div>${titleStatus}</div><div class="summary-grid"><div><div class="summary-label">GWA</div><strong class="summary-value">${Number(record.gwa).toFixed(2)}</strong></div><div><div class="summary-label">Enrolled units</div><strong class="summary-value">${record.units}</strong></div><div><div class="summary-label">Grade document reference</div><strong class="summary-value" style="font-size:11px">${escapeHtml(record.evidence)}</strong></div><div><div class="summary-label">Failed subjects</div><strong class="summary-value">${record.failed}</strong></div><div><div class="summary-label">Incomplete grades</div><strong class="summary-value">${record.incomplete}</strong></div><div><div class="summary-label">Dropped subjects</div><strong class="summary-value">${record.dropped}</strong></div></div></section>
  <section class="panel table-panel"><div class="panel-head"><div><h2>Compliance evaluation</h2><p>${evalResult ? (evalResult.status === "compliant" ? "All policy checks passed." : "Review the deficiencies below.") : "Evaluation is available after evidence verification."}</p></div>${evalResult ? `<span class="status ${evalResult.status}">${evalResult.status === "compliant" ? "Compliant" : "With Deficiency"}</span>` : ""}</div><div class="panel-body">${!evalResult ? `<div class="callout">${record.verification === "pending" ? "Evidence is pending verification. Evaluation is locked." : record.verification === "returned" ? "Returned evidence must be corrected and reverified before evaluation." : "Verified evidence is ready for staff evaluation."}</div>` : `<div class="check-list">${checks.map(([label, passed]) => `<div class="check-row"><span>${escapeHtml(label)}</span><span class="${passed ? "check-pass" : "check-fail"}">${passed ? "Pass" : "Fail"}</span></div>`).join("")}</div>${evalResult.reasons.length ? `<ul class="reason-list">${evalResult.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>` : ""}`}</div></section>
  ${record.verificationReason ? `<section class="panel table-panel"><div class="panel-head"><h2>Correction requested</h2></div><div class="panel-body">${escapeHtml(record.verificationReason)}</div></section>` : ""}
  </div><aside><section class="panel"><div class="panel-head"><div><h2>Renewal decision</h2><p>${record.decision ? "Decision recorded" : "No decision recorded"}</p></div></div><div class="panel-body">${record.decision ? `<span class="status ${record.decision}">${record.decision === "approved" ? "Approved" : "Held"}</span><p style="font-size:11px;line-height:1.6;color:#667067">${escapeHtml(record.decisionNote || "No decision note supplied.")}</p>` : `<div class="callout">${record.evaluation === "compliant" ? "Compliant evaluation; staff may approve or hold." : record.evaluation === "deficiency" ? "Deficient evaluation; approval is not permitted. Staff may hold." : "A verified evaluation is required before a renewal decision."}</div>`}<div class="decision-actions">${actions}</div></div></section>
  <section class="panel table-panel"><div class="panel-head"><div><h2>Record history</h2><p>Activity with actor and timestamp</p></div></div><div class="panel-body"><div class="history-list">${(record.history || []).slice().reverse().map(entry => `<div class="history-entry"><div class="history-title">${escapeHtml(entry.event)}</div><div class="history-meta">${escapeHtml(entry.actor)} · ${escapeHtml(dateLabel(entry.at))}</div></div>`).join("")}</div></div></section></aside></div>`;
}

function render() {
  const navLabels = { overview: "Overview", submissions: "Submissions", policy: "Policy records", scholars: "Scholars", "new-submission": "New submission", "register-scholar": "Register scholar" };
  $("#crumb-title").textContent = state.selectedId ? "Record detail" : navLabels[state.view] || "Overview";
  $$(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === state.view));
  const staffButtons = $$(".staff-only"); staffButtons.forEach(button => button.hidden = !isStaff());
  $("#nav-pending").textContent = state.records.filter(item => item.verification === "pending").length;
  if (state.selectedId) {
    const record = state.records.find(item => item.id === state.selectedId);
    if (!record || (!isStaff() && !state.demo && record.studentId !== state.user?.studentId)) { state.selectedId = null; state.view = "submissions"; }
    else { $("#main-content").innerHTML = renderDetail(record); bindPageEvents(); return; }
  }
  const views = { overview: renderOverview, submissions: renderSubmissions, policy: renderPolicy, scholars: renderScholars, "new-submission": () => renderSubmissionForm(state.records.find(item => item.id === state.correctionId)), "register-scholar": renderRegisterScholar };
  if (state.view === "scholars" && !isStaff()) state.view = "overview";
  $("#main-content").innerHTML = (views[state.view] || renderOverview)();
  bindPageEvents();
}
function addHistory(record, event) { record.history ||= []; record.history.push({ event, actor: state.user?.name || (isStaff() ? "Scholarship Staff" : "Scholar"), at: new Date().toISOString() }); }
function bindPageEvents() {
  $$('[data-view]').forEach(button => button.addEventListener("click", () => { state.view = button.dataset.view; state.selectedId = null; if (state.view !== "new-submission") state.correctionId = null; render(); }));
  $$('[data-open-record]').forEach(button => button.addEventListener("click", () => { state.selectedId = button.dataset.openRecord; render(); }));
  $$('[data-verify]').forEach(button => button.addEventListener("click", () => verifyRecord(button.dataset.verify)));
  const evalButton = $("[data-evaluate]"); if (evalButton) evalButton.addEventListener("click", evaluateSelected);
  $$('[data-decision]').forEach(button => button.addEventListener("click", () => decide(button.dataset.decision)));
  const correction = $("[data-correct]"); if (correction) correction.addEventListener("click", () => { const current = state.records.find(item => item.id === state.selectedId); state.correctionId = current.id; state.view = "new-submission"; state.selectedId = null; render(); fillCorrection(current); });
  const submissionForm = $("#submission-form"); if (submissionForm) submissionForm.addEventListener("submit", submitRecord);
  const registerForm = $("#register-form"); if (registerForm) registerForm.addEventListener("submit", registerScholar);
  const semesterSelect = $("#overview-semester"); if (semesterSelect) semesterSelect.addEventListener("change", () => { state.selectedSemester = semesterSelect.value; render(); });
  $$('[data-queue="pending"]').forEach(button => button.addEventListener("click", () => { state.view = "submissions"; state.selectedId = null; state.submissionStatusFilter = "pending"; render(); }));
  ["record-search", "program-filter", "status-filter"].forEach(id => { const element = document.getElementById(id); if (element) element.addEventListener(id === "record-search" ? "input" : "change", filterRecords); });
  ["scholar-search", "scholar-program-filter"].forEach(id => { const element = document.getElementById(id); if (element) element.addEventListener(id === "scholar-search" ? "input" : "change", filterScholars); });
}
function fillCorrection(record) {
  const form = $("#submission-form"); if (!form) return;
  for (const key of ["academicYear", "semester", "programId", "gwa", "units", "failed", "incomplete", "dropped", "evidence"]) { const field = form.elements.namedItem(key); if (field) field.value = record[key]; }
  form.dataset.recordId = record.id;
}
function filterRecords() {
  const q = ($("#record-search")?.value || "").trim().toLowerCase(); const programId = $("#program-filter")?.value || ""; const status = $("#status-filter")?.value || "";
  state.submissionStatusFilter = status;
  const filtered = getVisibleRecords().filter(record => {
    const statusMatch = !status || matchesStatus(record, status);
    return (!q || `${record.name} ${record.studentId}`.toLowerCase().includes(q)) && (!programId || record.programId === programId) && statusMatch;
  });
  $("#submissions-body").innerHTML = tableRows(filtered) || '<tr><td colspan="7"><div class="empty-state"><strong>No matching records</strong>Try another search or filter.</div></td></tr>'; bindPageEvents();
}
function filterScholars() {
  const q = ($("#scholar-search")?.value || "").trim().toLowerCase(); const p = $("#scholar-program-filter")?.value || "";
  const filtered = state.scholars.filter(scholar => (!q || `${scholar.name} ${scholar.studentId}`.toLowerCase().includes(q)) && (!p || scholar.programId === p));
  $("#scholars-body").innerHTML = scholarRows(filtered); bindPageEvents();
}
function scholarRows(scholars) {
  return scholars.map(scholar => {
    const record = state.records.find(item => item.studentId === scholar.studentId);
    return `<tr><td><div class="student-cell"><span class="student-mini">${escapeHtml(initials(scholar.name))}</span><span><span class="student-name">${escapeHtml(scholar.name)}</span><span class="student-id">${escapeHtml(scholar.studentId)}</span></span></div></td><td>${escapeHtml(program(scholar.programId).name)}</td><td>${record ? `${escapeHtml(record.academicYear)} · Sem ${escapeHtml(record.semester)}` : "No submission"}</td><td>${record ? escapeHtml(record.verification) : "—"}</td><td>${record ? escapeHtml(record.decision || record.evaluation || "Not evaluated") : "—"}</td><td>${record ? `<button class="button quiet small-button" data-open-record="${escapeHtml(record.id)}">Open →</button>` : "—"}</td></tr>`;
  }).join("") || '<tr><td colspan="6"><div class="empty-state"><strong>No assigned scholars</strong>Register an account to begin.</div></td></tr>';
}
function readSubmission(form) {
  const data = new FormData(form); const gwa = Number(data.get("gwa")); const counts = ["units", "failed", "incomplete", "dropped"].map(key => Number(data.get(key)));
  if (!Number.isFinite(gwa) || gwa < 1 || gwa > 5) throw new Error("GWA must be between 1.00 and 5.00.");
  if (counts.some(value => !Number.isInteger(value) || value < 0)) throw new Error("Units and subject counts must be nonnegative whole numbers.");
  if (!String(data.get("evidence") || "").trim()) throw new Error("A grade document reference is required.");
  return { academicYear: data.get("academicYear"), semester: data.get("semester"), programId: data.get("programId"), gwa, units: counts[0], failed: counts[1], incomplete: counts[2], dropped: counts[3], evidence: String(data.get("evidence")).trim() };
}
async function submitRecord(event) {
  event.preventDefault(); const form = event.currentTarget;
  try {
    const values = readSubmission(form); const recordId = form.dataset.recordId;
    if (state.demo) {
      if (recordId) {
        const record = state.records.find(item => item.id === recordId); Object.assign(record, values); record.verification = "pending"; record.verificationReason = ""; record.evaluation = null; record.reasons = []; record.decision = null; record.decisionNote = ""; record.submittedAt = new Date().toISOString(); addHistory(record, "Corrected submission received; verification reset to Pending");
      } else {
        const ownerId = isStaff() ? String(new FormData(form).get("studentId")).trim() : state.user.studentId;
        const duplicate = state.records.some(item => item.studentId === ownerId && item.academicYear === values.academicYear && item.semester === values.semester);
        if (duplicate) throw new Error("A submission already exists for this scholar, academic year, and semester.");
        const record = { id: `demo-${Date.now()}`, studentId: ownerId, name: isStaff() ? ownerId : state.user.name, ...values, submittedAt: new Date().toISOString(), verification: "pending", verificationReason: "", evaluation: null, reasons: [], decision: null, decisionNote: "", history: [] }; addHistory(record, "Submission received"); state.records.unshift(record);
      }
      persistDemo(); state.view = "submissions"; state.selectedId = null; state.correctionId = null; render(); toast("Submission saved and set to Pending verification."); return;
    }
    if (recordId) {
      const { error } = await supabaseClient.from("submissions").update({ academic_year: values.academicYear, semester: Number(values.semester), program_id: values.programId, gwa: values.gwa, enrolled_units: values.units, failed_subjects: values.failed, incomplete_grades: values.incomplete, dropped_subjects: values.dropped, grade_document_ref: values.evidence, verification_status: "pending", verification_reason: null, evaluation_status: null, deficiency_reasons: null }).eq("id", recordId);
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.from("submissions").insert({ scholar_id: state.user.id, program_id: values.programId, academic_year: values.academicYear, semester: Number(values.semester), gwa: values.gwa, enrolled_units: values.units, failed_subjects: values.failed, incomplete_grades: values.incomplete, dropped_subjects: values.dropped, grade_document_ref: values.evidence });
      if (error) throw error;
    }
    await loadLiveData(); state.view = "submissions"; state.correctionId = null; render(); toast("Submission saved.");
  } catch (error) { toast(error.message || "Could not save submission.", true); }
}
async function verifyRecord(status) {
  const record = state.records.find(item => item.id === state.selectedId); if (!record) return;
  const reason = status === "returned" ? prompt("Reason for returning this evidence (required):") : "";
  if (status === "returned" && !reason?.trim()) { toast("A reason is required when returning evidence.", true); return; }
  try {
    if (state.demo) { record.verification = status; record.verificationReason = reason?.trim() || ""; addHistory(record, status === "verified" ? "Evidence verified" : `Evidence returned: ${reason.trim()}`); persistDemo(); }
    else { const { error } = await supabaseClient.rpc("verify_submission", { p_submission_id: record.id, p_status: status, p_reason: reason?.trim() || null }); if (error) throw error; await loadLiveData(); }
    render(); toast(status === "verified" ? "Evidence verified." : "Returned for correction.");
  } catch (error) { toast(error.message || "Verification failed.", true); }
}
async function evaluateSelected() {
  const record = state.records.find(item => item.id === state.selectedId); if (!record) return;
  try {
    if (state.demo) { if (record.verification !== "verified") throw new Error("Evidence must be verified before evaluation."); const result = evaluate(record); record.evaluation = result.status; record.reasons = result.reasons; addHistory(record, `Compliance evaluated: ${result.status === "compliant" ? "Compliant" : "With Deficiency"}`); persistDemo(); }
    else { const { error } = await supabaseClient.rpc("evaluate_submission", { p_submission_id: record.id }); if (error) throw error; await loadLiveData(); }
    render(); toast(record.evaluation === "compliant" ? "Evaluation complete: Compliant." : "Evaluation complete: With Deficiency.");
  } catch (error) { toast(error.message || "Evaluation failed.", true); }
}
async function decide(status) {
  const record = state.records.find(item => item.id === state.selectedId); if (!record) return;
  const note = prompt(`${status === "approved" ? "Approval" : "Hold"} decision note (required):`);
  if (!note?.trim()) { toast("A decision note is required.", true); return; }
  try {
    if (state.demo) {
      if (!record.evaluation) throw new Error("Evaluate a verified submission before deciding.");
      if (status === "approved" && record.evaluation !== "compliant") throw new Error("Only compliant submissions may be approved.");
      record.decision = status; record.decisionNote = note.trim(); addHistory(record, `${status === "approved" ? "Renewal approved" : "Renewal held"}: ${note.trim()}`); persistDemo();
    } else { const { error } = await supabaseClient.rpc("decide_renewal", { p_submission_id: record.id, p_decision: status, p_note: note.trim() }); if (error) throw error; await loadLiveData(); }
    render(); toast(status === "approved" ? "Renewal approved." : "Renewal held.");
  } catch (error) { toast(error.message || "Decision could not be saved.", true); }
}
async function registerScholar(event) {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  try {
    if (state.demo) throw new Error("Scholar account assignment is available only in live Supabase mode. Demo scholar switching is for workflow testing only.");
    const { error } = await supabaseClient.rpc("register_scholar", { p_email: data.get("email"), p_student_id: data.get("studentId"), p_display_name: data.get("name"), p_program_id: data.get("programId") }); if (error) throw error;
    await loadLiveData(); state.view = "scholars"; render(); toast("Scholar assignment saved.");
  } catch (error) { toast(error.message || "Assignment failed.", true); }
}
function recordFromLive(row) {
  return { id: row.id, studentId: row.profiles?.student_id || "", name: row.profiles?.display_name || "Scholar", programId: row.program_id, academicYear: row.academic_year, semester: String(row.semester), gwa: row.gwa, units: row.enrolled_units, failed: row.failed_subjects, incomplete: row.incomplete_grades, dropped: row.dropped_subjects, submittedAt: row.submitted_at, evidence: row.grade_document_ref, verification: row.verification_status, verificationReason: row.verification_reason || "", evaluation: row.evaluation_status, reasons: row.deficiency_reasons || [], decision: row.renewal_decision, decisionNote: row.decision_note || "", history: (row.audit_events || []).map(entry => ({ event: entry.event_type, actor: entry.actor_label, at: entry.occurred_at })) };
}
async function loadLiveData() {
  const { data: programRows, error: programError } = await supabaseClient.from("programs").select("id, name, max_gwa, min_units, max_failed, max_incomplete, max_dropped, deadline").eq("active", true).order("name");
  if (programError) throw programError;
  PROGRAMS = (programRows || []).map(row => ({ id: row.id, name: row.name, max_gwa: Number(row.max_gwa), min_units: row.min_units, max_failed: row.max_failed, max_incomplete: row.max_incomplete, max_dropped: row.max_dropped, deadline: row.deadline }));
  const { data, error } = await supabaseClient.from("submissions").select("*, profiles!submissions_scholar_id_fkey(student_id, display_name), audit_events(*)").order("submitted_at", { ascending: false });
  if (error) throw error; state.records = (data || []).map(recordFromLive);
  if (isStaff()) {
    const { data: profiles, error: profileError } = await supabaseClient.from("profiles").select("student_id, display_name, program_id").eq("role", "scholar").order("student_id");
    if (profileError) throw profileError;
    state.scholars = (profiles || []).map(profile => ({ studentId: profile.student_id, name: profile.display_name, programId: profile.program_id }));
  } else {
    state.scholars = [{ studentId: state.user.studentId, name: state.user.name, programId: state.user.programId }];
  }
}
async function initializeLive() {
  const config = window.SCHOLARSHIP_CONFIG;
  if (!config?.supabaseUrl || !config?.supabaseAnonKey || config.supabaseUrl.includes("YOUR-PROJECT")) return false;
  if (!window.supabase?.createClient) return false;
  supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return false;
  const { data: profile, error } = await supabaseClient.from("profiles").select("id, role, student_id, display_name, program_id").eq("id", session.user.id).single();
  if (error || !profile) { await supabaseClient.auth.signOut(); return false; }
  state.demo = false; state.role = profile.role; state.user = { id: profile.id, studentId: profile.student_id, name: profile.display_name, programId: profile.program_id, email: session.user.email };
  await loadLiveData(); $("#connection-state").innerHTML = "<i></i>Supabase connected"; $("#connection-state").classList.add("live");
  return true;
}
function enterDemo(role) {
  state.demo = true; state.role = role; state.submissionStatusFilter = ""; state.user = role === "staff" ? { id: "demo-staff", studentId: "STAFF", name: "Scholarship Staff" } : { id: "demo-scholar", studentId: "A01", name: "Mikaela Santos", programId: "merit" };
  loadDemo(); $("#auth-dialog").close(); updateProfile(); render();
}
function updateProfile() { $("#profile-name").textContent = state.user?.name || "Scholar"; $("#profile-role").textContent = isStaff() ? "Scholarship Staff" : "Scholar account"; $("#avatar").textContent = initials(state.user?.name); }
async function onLogin(event) {
  event.preventDefault(); const email = $("#email").value.trim(); const password = $("#password").value;
  if (!supabaseClient) { showAuthError("Live Supabase client is not configured. Use a demo account or add valid config.js settings."); return; }
  try {
    if (state.authMode === "register") {
      const displayName = $("#register-name").value.trim();
      const studentId = $("#register-student-id").value.trim();
      const programId = $("#register-program").value;
      if (!displayName || !/^[A-Za-z0-9-]+$/.test(studentId)) throw new Error("Enter your full name and a Student ID using letters, numbers, or hyphens.");
      if (password.length < 8) throw new Error("Password must be at least 8 characters.");
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName, student_id: studentId, program_id: programId } }
      });
      if (error) throw error;
      if (data.session) {
        const live = await initializeLive();
        if (!live) throw new Error("Account created, but its Scholar profile was not found. Apply the signup-profile SQL migration, then sign in again.");
        updateProfile(); render(); $("#auth-dialog").close(); toast("Scholar account created.");
      } else {
        showAuthError("Account created. Check your email to confirm it, then log in. If confirmation is disabled, log in now.");
      }
      return;
    }
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) throw error;
    const live = await initializeLive(); if (!live) throw new Error("Signed in, but no profile/role is assigned. Ask staff to register this account.");
    state.submissionStatusFilter = ""; updateProfile(); render(); $("#auth-dialog").close();
  } catch (error) { showAuthError(error.message || "Sign-in failed."); }
}
function showAuthError(message) { $("#auth-error").textContent = message; $("#auth-error").classList.add("visible"); }
function setAuthMode(mode) {
  state.authMode = mode;
  const registering = mode === "register";
  $("#auth-title").textContent = registering ? "Create your account" : "Welcome back";
  $("#auth-intro").textContent = registering ? "Create a Scholar account to submit and track renewals." : "Log in to continue to your scholarship workspace.";
  $("#auth-submit").innerHTML = registering ? 'Create Scholar account <span>→</span>' : 'Login <span>→</span>';
  $("#register-fields").hidden = !registering;
  $("#register-name").required = registering;
  $("#register-student-id").required = registering;
  $$("[data-auth-mode]").forEach(button => {
    const active = button.dataset.authMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("#auth-error").classList.remove("visible");
}
async function signOut() {
  if (state.demo) { state.role = ""; state.user = null; $("#auth-dialog").showModal(); return; }
  await supabaseClient.auth.signOut(); state.role = ""; state.user = null; state.records = []; $("#auth-dialog").showModal();
}
function bindGlobalEvents() {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => { state.view = button.dataset.view; state.selectedId = null; if (state.view !== "new-submission") state.correctionId = null; render(); }));
  $("#sign-out").addEventListener("click", signOut); $("#profile-button").addEventListener("click", signOut);
  $("#refresh-button").addEventListener("click", async () => { try { if (state.demo) loadDemo(); else await loadLiveData(); render(); toast("Workspace refreshed."); } catch (error) { toast(error.message, true); } });
  $("#auth-form").addEventListener("submit", onLogin);
  $$('[data-auth-mode]').forEach(button => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
  $$('[data-demo-role]').forEach(button => button.addEventListener("click", () => enterDemo(button.dataset.demoRole)));
}

async function boot() {
  bindGlobalEvents();
  try { if (await initializeLive()) { updateProfile(); render(); return; } } catch { /* Fall through to isolated local demo. */ }
  loadDemo(); $("#auth-dialog").showModal();
}
boot();