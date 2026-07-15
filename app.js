const DATA_PATH = "./data/data/demo_cases_display.json";

const state = {
  data: null,
  filteredCases: [],
  selectedCaseId: null,
  selectedStepIndex: 0,
  goalFilter: "all",
  isAutoPlaying: false,
  autoPlayTimer: null,
};

const elements = {
  heroMetrics: document.querySelector("#heroMetrics"),
  goalFilter: document.querySelector("#goalFilter"),
  caseList: document.querySelector("#caseList"),
  briefPanel: document.querySelector("#briefPanel"),
  milestoneRail: document.querySelector("#milestoneRail"),
  timeline: document.querySelector("#timeline"),
  nodePanel: document.querySelector("#nodePanel"),
  transitionPanel: document.querySelector("#transitionPanel"),
  filesPanel: document.querySelector("#filesPanel"),
  stepCounter: document.querySelector("#stepCounter"),
  autoPlayToggle: document.querySelector("#autoPlayToggle"),
  prevStep: document.querySelector("#prevStep"),
  nextStep: document.querySelector("#nextStep"),
  caseCardTemplate: document.querySelector("#caseCardTemplate"),
};

const statusClassMap = {
  normal: "status-normal",
  injection_seen: "status-injection_seen",
  suspicious_action: "status-suspicious_action",
  goal_reached: "status-goal_reached",
};

init();

async function init() {
  bindEvents();

  try {
    const response = await fetch(DATA_PATH);
    if (!response.ok) {
      throw new Error(`Failed to load replay data: ${response.status}`);
    }

    state.data = await response.json();
    hydrateGoalFilter();
    applyFilters();
    render();
  } catch (error) {
    renderError(error);
  }
}

function bindEvents() {
  elements.goalFilter.addEventListener("change", (event) => {
    stopAutoPlay();
    state.goalFilter = event.target.value;
    applyFilters();
    render();
  });

  elements.autoPlayToggle.addEventListener("click", toggleAutoPlay);

  elements.prevStep.addEventListener("click", () => {
    const currentCase = getSelectedCase();
    if (!currentCase || state.selectedStepIndex === 0) {
      return;
    }

    stopAutoPlay();
    state.selectedStepIndex -= 1;
    renderStepViews(currentCase);
  });

  elements.nextStep.addEventListener("click", () => {
    const currentCase = getSelectedCase();
    if (!currentCase || state.selectedStepIndex >= currentCase.replay.steps.length - 1) {
      return;
    }

    stopAutoPlay();
    state.selectedStepIndex += 1;
    renderStepViews(currentCase);
  });
}

function hydrateGoalFilter() {
  const goalClasses = [...new Set(state.data.cases.map((item) => item.goal_class_label || item.goal_class))];
  goalClasses.sort((left, right) => left.localeCompare(right));

  for (const goalClass of goalClasses) {
    const option = document.createElement("option");
    option.value = goalClass;
    option.textContent = goalClass;
    elements.goalFilter.append(option);
  }
}

function applyFilters() {
  const cases = state.data.cases.filter((item) => {
    if (state.goalFilter === "all") {
      return true;
    }
    return (item.goal_class_label || item.goal_class) === state.goalFilter;
  });

  state.filteredCases = cases;

  if (!cases.length) {
    state.selectedCaseId = null;
    state.selectedStepIndex = 0;
    return;
  }

  if (!cases.some((item) => item.case_id === state.selectedCaseId)) {
    state.selectedCaseId = cases[0].case_id;
    state.selectedStepIndex = 0;
  }
}

function render() {
  renderHero();
  renderCaseList();

  const currentCase = getSelectedCase();
  if (!currentCase) {
    renderEmptyState();
    return;
  }

  renderBrief(currentCase);
  renderStepViews(currentCase);
}

function renderHero() {
  const cases = state.data.cases;
  const goalReached = cases.filter((item) => item.result_status === "goal_reached").length;
  const injectedSteps = cases.reduce((count, item) => {
    return count + item.replay.steps.filter((step) => step.risk_status === "injection_seen").length;
  }, 0);
  const allSteps = cases.reduce((count, item) => count + item.step_count, 0);

  elements.heroMetrics.innerHTML = "";
  const metrics = [
    {
      label: "Replay Cases",
      value: `${cases.length}`,
      note: "Curated set of attacked runs from the display dataset.",
    },
    {
      label: "Total Steps",
      value: `${allSteps}`,
      note: "Step-by-step replay with per-step explanations and status.",
    },
    {
      label: "Action-Level Match",
      value: `${goalReached}/${cases.length}`,
      note: "The agent issued an action matching the attack goal, not necessarily a real-world effect.",
    },
    {
      label: "Injection Steps",
      value: `${injectedSteps}`,
      note: state.data.static_replay_notice,
    },
  ];

  for (const metric of metrics) {
    const card = document.createElement("article");
    card.className = "metric-card";
    card.innerHTML = `
      <div class="metric-label">${escapeHtml(metric.label)}</div>
      <div class="metric-value">${escapeHtml(metric.value)}</div>
      <div class="metric-note">${escapeHtml(metric.note)}</div>
    `;
    elements.heroMetrics.append(card);
  }
}

function renderCaseList() {
  elements.caseList.innerHTML = "";

  for (const item of state.filteredCases) {
    const fragment = elements.caseCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".case-card");
    const dot = fragment.querySelector(".case-status-dot");
    const title = fragment.querySelector(".case-title");
    const subtitle = fragment.querySelector(".case-subtitle");
    const badges = fragment.querySelector(".case-badges");

    card.classList.toggle("is-active", item.case_id === state.selectedCaseId);
    dot.classList.add(accentClass(item.result_status));
    title.textContent = getDisplayTitle(item);
    subtitle.textContent = `${safeText(item.scenario_label)} · ${safeText(item.goal_class_label)} · ${safeText(item.result_label)}`;

    const badgeValues = [
      formatToken(getAttackSurface(item)),
      `${item.step_count} steps`,
      `Goal @ ${item.goal_step ?? "-"}`,
    ];

    for (const value of badgeValues) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = value;
      badges.append(badge);
    }

    card.addEventListener("click", () => {
      state.selectedCaseId = item.case_id;
      state.selectedStepIndex = 0;
      stopAutoPlay();
      render();
    });

    elements.caseList.append(fragment);
  }
}

function renderBrief(currentCase) {
  const summary = currentCase.layout_summary || {};
  const topBadges = [
    safeText(currentCase.scenario_label),
    safeText(currentCase.goal_class_label),
    safeText(currentCase.result_label),
    formatToken(getAttackSurface(currentCase)),
  ]
    .map((value) => `<span class="badge">${escapeHtml(value)}</span>`)
    .join("");

  elements.briefPanel.innerHTML = `
    <div class="section-head">
      <div>
        <p class="eyebrow">Mission Brief</p>
        <h2>${escapeHtml(getDisplayTitle(currentCase))}</h2>
      </div>
      <div class="brief-grid">${topBadges}</div>
    </div>
    <div class="brief-grid">
      <article class="info-chip info-chip-wide">
        <strong>Case Selection</strong>
        <span>${renderValue(currentCase.case_id)}</span>
      </article>
      <article class="info-chip">
        <strong>Original Task</strong>
        <span>${renderValue(summary.original_task)}</span>
      </article>
      <article class="info-chip">
        <strong>Injected Instruction</strong>
        <span>${renderValue(summary.injected_content)}</span>
      </article>
      <article class="info-chip">
        <strong>Attack Goal</strong>
        <span>${renderValue(summary.attacker_goal)}</span>
      </article>
      <article class="info-chip">
        <strong>Target Outcome</strong>
        <span>${renderValue(currentCase.result_description)}</span>
      </article>
    </div>
  `;
}

function renderStepViews(currentCase) {
  const step = currentCase.replay.steps[state.selectedStepIndex];
  renderMilestones(currentCase, step);
  renderTimeline(currentCase, step);
  renderNodePanel(step);
  renderTransitionPanel(currentCase, step);
  renderFilesPanel(currentCase, step);
  updateStepControls(currentCase);
}

function renderMilestones(currentCase, currentStep) {
  elements.milestoneRail.innerHTML = "";
  for (const milestone of currentCase.milestones) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "milestone-chip";
    chip.classList.toggle("is-active", currentStep.step >= milestone.step);
    chip.textContent = `${safeText(milestone.label)} · Step ${milestone.step}`;
    chip.addEventListener("click", () => {
      stopAutoPlay();
      state.selectedStepIndex = Math.max(0, milestone.step - 1);
      renderStepViews(currentCase);
    });
    elements.milestoneRail.append(chip);
  }
}

function renderTimeline(currentCase, currentStep) {
  elements.timeline.innerHTML = "";

  const card = document.createElement("article");
  card.className = "step-card is-active";

  const friendlyAction = describeAction(currentStep);
  const statusClass = statusClassMap[currentStep.risk_status] || "status-normal";
  const nearbySteps = getNeighborSteps(currentCase.replay.steps, state.selectedStepIndex)
    .map((step) => `<span class="badge">Step ${step.step}: ${escapeHtml(safeText(step.phase_label))}</span>`)
    .join("");
  const progress = Math.max(0, Math.min(100, (currentStep.step / currentCase.replay.steps.length) * 100));

  card.innerHTML = `
    <div class="step-card-top">
      <div>
        <div class="step-index">Step ${currentStep.step}</div>
        <div class="step-title">${escapeHtml(safeText(currentStep.phase_label))}</div>
      </div>
      <span class="status-pill ${statusClass}">${escapeHtml(safeText(currentStep.risk_label))}</span>
    </div>
    <p class="step-summary">${escapeHtml(friendlyAction.summary)}</p>
    <p class="step-summary">${renderValue(currentStep.phase_description)}</p>
    <p class="step-summary">${renderValue(currentStep.viewer_explanation)}</p>
    <div class="legend-row">${nearbySteps}</div>
    <div class="progress-track"><div class="progress-bar" style="width: ${progress}%"></div></div>
  `;

  elements.timeline.append(card);
  elements.stepCounter.textContent = `Step ${currentStep.step}/${currentCase.replay.steps.length}`;
}

function renderNodePanel(step) {
  const friendlyAction = describeAction(step);
  const files = extractFiles(step);
  const fileList = files.length
    ? files.map((file) => `<span class="file-chip">${escapeHtml(file)}</span>`).join("")
    : `<span class="file-chip missing-chip">No explicit file captured</span>`;

  elements.nodePanel.innerHTML = `
    <p class="eyebrow">Current Node</p>
    <h3>${escapeHtml(safeText(step.phase_label))}</h3>
    <div class="state-card">
      <div class="detail-copy"><strong>What happens now:</strong> ${escapeHtml(friendlyAction.summary)}</div>
      <div class="detail-copy"><strong>Observed effect:</strong> ${renderValue(step.observation_display)}</div>
      <div class="detail-copy"><strong>Injection signal:</strong> ${renderValue(step.injection_display)}</div>
      <div class="detail-copy"><strong>Current status:</strong> ${renderValue(step.risk_label)}</div>
      <div class="detail-copy"><strong>Goal state:</strong> ${renderValue(step.goal_status_display)}</div>
    </div>
    <div class="legend-row">
      <span class="status-pill ${statusClassMap[step.risk_status] || "status-normal"}">${escapeHtml(safeText(step.risk_label))}</span>
      <span class="badge">${escapeHtml(formatToken(step.phase_key))}</span>
      <span class="badge">${step.requires_user_gate ? `Gate: ${escapeHtml(safeText(step.gate_type))}` : "No gate"}</span>
      <span class="badge">${step.is_key_step ? "Key step" : "Supporting step"}</span>
    </div>
    <div>
      <h3>Files in this node</h3>
      <div class="files-grid">${fileList}</div>
    </div>
    <div class="note-box">${renderValue(step.viewer_explanation)}</div>
  `;
}

function renderTransitionPanel(currentCase, currentStep) {
  const steps = currentCase.replay.steps;
  const currentIndex = state.selectedStepIndex;
  const prev = steps[currentIndex - 1];
  const next = steps[currentIndex + 1];

  elements.transitionPanel.innerHTML = `
    <p class="eyebrow">State Transition</p>
    <h3>Current Status Shift</h3>
    <div class="state-card">
      <div class="state-row">
        ${renderStateNode("Previous", prev ? prev.risk_label : "Start", prev?.risk_status)}
        ${renderStateNode("Current", currentStep.risk_label, currentStep.risk_status, true)}
        ${renderStateNode("Next", next ? next.risk_label : "Final", next?.risk_status)}
      </div>
      <div class="detail-copy">
        This panel stays focused on the active transition only, so the audience follows the live state change instead of scanning the full trace at once.
      </div>
    </div>
  `;
}

function renderFilesPanel(currentCase, currentStep) {
  const groupedFiles = groupFilesFromCase(currentCase);
  const currentFiles = extractFiles(currentStep);

  const sections = Object.entries(groupedFiles)
    .filter(([, values]) => values.length)
    .map(([label, values]) => {
      return `
        <div>
          <h3>${escapeHtml(label)}</h3>
          <div class="files-grid">
            ${values
              .map((file) => {
                const active = currentFiles.includes(file) ? " status-normal" : "";
                return `<span class="file-chip${active}">${escapeHtml(file)}</span>`;
              })
              .join("")}
          </div>
        </div>
      `;
    })
    .join("");

  elements.filesPanel.innerHTML = `
    <p class="eyebrow">Case Materials</p>
    <h3>Files That Differentiate This Case</h3>
    <div class="detail-copy">
      Each case touches a different mix of inbox prompts, authoritative files, tool outputs, stale notes, and action targets. Highlighted chips belong to the current step.
    </div>
    ${sections}
  `;
}

function updateStepControls(currentCase) {
  elements.prevStep.disabled = state.selectedStepIndex === 0;
  elements.nextStep.disabled = state.selectedStepIndex === currentCase.replay.steps.length - 1;
  elements.autoPlayToggle.textContent = state.isAutoPlaying ? "Pause" : "Auto Play";
}

function renderEmptyState() {
  stopAutoPlay();
  const message = `
    <p class="eyebrow">No Match</p>
    <h2>No cases match the current filter.</h2>
    <p class="detail-copy">Pick another goal class to continue exploring the replay dataset.</p>
  `;

  elements.briefPanel.innerHTML = message;
  elements.milestoneRail.innerHTML = "";
  elements.timeline.innerHTML = "";
  elements.nodePanel.innerHTML = message;
  elements.transitionPanel.innerHTML = message;
  elements.filesPanel.innerHTML = message;
  elements.stepCounter.textContent = "";
}

function renderError(error) {
  const message = `
    <p class="eyebrow">Data Load Error</p>
    <h2>Replay data could not be loaded.</h2>
    <p class="detail-copy">${escapeHtml(safeText(error.message))}</p>
    <div class="note-box">Serve this folder with a local static server so the browser can fetch <code>${escapeHtml(DATA_PATH)}</code>.</div>
  `;

  elements.heroMetrics.innerHTML = "";
  elements.caseList.innerHTML = "";
  elements.briefPanel.innerHTML = message;
  elements.timeline.innerHTML = "";
  elements.nodePanel.innerHTML = message;
  elements.transitionPanel.innerHTML = message;
  elements.filesPanel.innerHTML = message;
}

function getSelectedCase() {
  return state.filteredCases.find((item) => item.case_id === state.selectedCaseId) || null;
}

function toggleAutoPlay() {
  if (state.isAutoPlaying) {
    stopAutoPlay();
    const currentCase = getSelectedCase();
    if (currentCase) {
      updateStepControls(currentCase);
    }
    return;
  }

  const currentCase = getSelectedCase();
  if (!currentCase) {
    return;
  }

  if (state.selectedStepIndex >= currentCase.replay.steps.length - 1) {
    state.selectedStepIndex = 0;
    renderStepViews(currentCase);
  }

  state.isAutoPlaying = true;
  elements.autoPlayToggle.textContent = "Pause";
  state.autoPlayTimer = window.setInterval(() => {
    const activeCase = getSelectedCase();
    if (!activeCase) {
      stopAutoPlay();
      return;
    }

    if (state.selectedStepIndex >= activeCase.replay.steps.length - 1) {
      stopAutoPlay();
      updateStepControls(activeCase);
      return;
    }

    state.selectedStepIndex += 1;
    renderStepViews(activeCase);
  }, 1800);
}

function stopAutoPlay() {
  state.isAutoPlaying = false;
  if (state.autoPlayTimer !== null) {
    window.clearInterval(state.autoPlayTimer);
    state.autoPlayTimer = null;
  }
}

function describeAction(step) {
  const rawAction = step.technical_details?.raw_action || "";
  const fileMatch = rawAction.match(/path=([^)]+)/);
  const targetMatch = rawAction.match(/target=([^,)\s]+)/);

  if (rawAction.startsWith("read(path=") && fileMatch) {
    return { summary: `Read the file ${cleanValue(fileMatch[1])} to gather task context.` };
  }

  if (rawAction.startsWith("write(path=") && fileMatch) {
    return { summary: `Write the output file ${cleanValue(fileMatch[1])} as a generated artifact.` };
  }

  if (rawAction.startsWith("scan_files_mock")) {
    return { summary: "Scan a protected directory to look for sensitive files." };
  }

  if (rawAction.startsWith("list_sensitive_paths_mock")) {
    return { summary: "Query the environment for a list of sensitive internal paths." };
  }

  if (rawAction.startsWith("read_sensitive_record_mock")) {
    return { summary: "Attempt to open a protected sensitive record." };
  }

  if (rawAction.startsWith("update_workflow_mock")) {
    return { summary: "Change an internal workflow state inside the system." };
  }

  if (rawAction.startsWith("update_record_mock")) {
    return { summary: "Modify an internal record to reflect a new state." };
  }

  if (rawAction.startsWith("call_webhook_mock")) {
    return { summary: "Send information to an external webhook endpoint." };
  }

  if (rawAction.startsWith("exec_command_mock")) {
    return { summary: "Trigger a high-impact local command in the environment." };
  }

  if (rawAction.startsWith("unknown_tool")) {
    return { summary: "Perform an internal tool action that was recorded without a friendly label." };
  }

  if (rawAction.startsWith("read()")) {
    return { summary: "Read supporting context, but the exact file was not captured in the replay." };
  }

  if (targetMatch) {
    return { summary: `Run a targeted action against ${cleanValue(targetMatch[1])}.` };
  }

  return { summary: safeText(step.agent_action_display) };
}

function extractFiles(step) {
  const source = [step.technical_details?.raw_action || "", step.technical_details?.raw_observation || ""].join(" ");

  const matches = [...source.matchAll(/(?:path=|file\s)([A-Za-z0-9_./:-]+\.[A-Za-z0-9]+|[A-Za-z0-9_./:-]+\/)/g)];
  const files = matches.map((match) => cleanValue(match[1]));

  const targetMatches = [...source.matchAll(/target=([A-Za-z0-9_./:-]+\.[A-Za-z0-9]+|[A-Za-z0-9_./:-]+\/)/g)];
  for (const match of targetMatches) {
    files.push(cleanValue(match[1]));
  }

  return [...new Set(files)];
}

function groupFilesFromCase(currentCase) {
  const files = currentCase.replay.steps.flatMap((step) => extractFiles(step));
  const uniqueFiles = [...new Set(files)];

  const buckets = {
    Inbox: [],
    "Authoritative Files": [],
    "Tool Outputs": [],
    "Stale Or Legacy": [],
    Versions: [],
    Outputs: [],
    "Targets Or Other": [],
  };

  for (const file of uniqueFiles) {
    if (file.startsWith("inbox/")) {
      buckets.Inbox.push(file);
    } else if (file.includes("authoritative")) {
      buckets["Authoritative Files"].push(file);
    } else if (file.startsWith("tool_outputs/")) {
      buckets["Tool Outputs"].push(file);
    } else if (file.includes("stale") || file.includes("legacy")) {
      buckets["Stale Or Legacy"].push(file);
    } else if (file.includes("versions")) {
      buckets.Versions.push(file);
    } else if (file.includes("outputs")) {
      buckets.Outputs.push(file);
    } else {
      buckets["Targets Or Other"].push(file);
    }
  }

  return buckets;
}

function renderStateNode(label, value, riskStatus, isCurrent = false) {
  return `
    <div class="state-node ${isCurrent ? "current" : ""}">
      <div class="state-node-label">${escapeHtml(safeText(label))}</div>
      <div class="state-node-value ${accentClass(riskStatus)}">${escapeHtml(safeText(value))}</div>
    </div>
  `;
}

function accentClass(status) {
  if (!status) {
    return "accent-normal";
  }
  return `accent-${status}`;
}

function formatToken(value) {
  return safeText(value).replace(/_/g, " ");
}

function safeText(value, fallback = "Not available") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  return String(value);
}

function renderValue(value, fallback = "Missing field") {
  if (value === null || value === undefined || value === "") {
    return `<span class="missing-chip">${escapeHtml(fallback)}</span>`;
  }
  return escapeHtml(String(value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAttackSurface(item) {
  return item.attack_surface || item.technical_details?.attack_surface || "unknown_surface";
}

function getDisplayTitle(item) {
  if (item.case_id === "finance__finance_t01__c2_03_v2__combined_attack__dynamic_tool_output_injection__defence_none") {
    return "Case C2_03 - State Mutation";
  }
  return safeText(item.short_title);
}

function getNeighborSteps(steps, currentIndex) {
  const indexes = [currentIndex - 1, currentIndex, currentIndex + 1].filter(
    (index) => index >= 0 && index < steps.length
  );
  return indexes.map((index) => steps[index]);
}

function cleanValue(value) {
  return String(value).replace(/[.)]+$/g, "").replace(/\.\.\.$/, "...");
}
