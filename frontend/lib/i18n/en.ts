/**
 * English source of truth for citizen-facing copy.
 *
 * `MessageKey` is derived from this object, so every other language file is
 * typed as `Record<MessageKey, string>` — a missing or misspelled key is a
 * TypeScript error, not a silent English fallback.
 *
 * Placeholders use `{name}` and are filled by `t(key, { name })`.
 */

const en = {
  // ── Header ──
  home: "Home",
  register: "Register Grievance",
  track: "Track Grievance",
  signIn: "Sign in",
  signOut: "Sign out",
  createAccount: "Create an account",
  submit: "Submit Grievance",
  language: "Language",
  brandTagline: "National Grievance Portal",

  // ── Footer ──
  footerAbout:
    "AI-assisted grievance redressal and decision-support prototype for transparent civic workflows.",
  footerSignIn: "Sign In",
  footerCreateAccount: "Create Account",
  footerQuickLinks: "Quick Links",
  footerServicesHeading: "Citizen Services",
  footerContactHeading: "Contact & Support",
  svcRegister: "Register a public grievance",
  svcTrack: "Track grievance status & timeline",
  svcAssign: "Officer assignment & resolution",
  svcAi: "AI-assisted categorization",
  contactLocation: "Location-aware civic issue reporting",
  accountabilityLabel: "Accountability:",
  accountabilityText:
    "Department actions and status transitions are recorded for accountable human review.",
  copyright: "GrievAI — Civic grievance redressal prototype.",

  // ── Home: hero ──
  homeBadge: "National public grievance portal",
  homeTitle: "Make your community better, one request at a time.",
  homeSubtitle:
    "Report a civic issue with the details that matter, see where it goes, and follow its progress through a transparent, human-reviewed process.",
  homeCtaRegister: "Register a complaint",
  homeCtaTrack: "Track a request",
  homeFree: "Free to use",
  homeLocation: "Location-aware",
  homeHuman: "Human decisions",
  homePathTitle: "A clearer path to resolution",
  homePathSub: "What happens after you submit",
  homeStep1Title: "You share the facts",
  homeStep1Text: "Issue, evidence, and exact location.",
  homeStep2Title: "The request is organized",
  homeStep2Text: "AI-assisted triage suggests routing and priority.",
  homeStep3Title: "An officer takes responsibility",
  homeStep3Text: "A human team reviews, acts, and updates you.",

  // ── Home: principles ──
  principle1Title: "Location-aware",
  principle1Text:
    "Pin the place where the issue happened so the right local team can act.",
  principle2Title: "Assisted triage",
  principle2Text:
    "AI helps organize the report; authorized officers remain responsible for decisions.",
  principle3Title: "Human-reviewed",
  principle3Text:
    "Every assignment, update, and resolution stays under accountable human control.",

  // ── Home: categories ──
  reportBadge: "Start with the right details",
  reportTitle: "What can you report?",
  reportText:
    "Choose the closest category or simply describe the issue. The system helps route it to the appropriate civic department.",
  reportLink: "View registration form",
  deptWaterLabel: "Water & sanitation",
  deptWaterDesc: "Leaks, drainage, supply, and waste",
  deptRoadsLabel: "Roads & transport",
  deptRoadsDesc: "Roads, traffic, transit, and signals",
  deptElectricityLabel: "Electricity",
  deptElectricityDesc: "Outages, streetlights, and distribution",
  deptHealthLabel: "Health services",
  deptHealthDesc: "Public health and medical facilities",
  deptGovLabel: "Civic governance",
  deptGovDesc: "Certificates, services, and public offices",
  deptOtherLabel: "Other public issues",
  deptOtherDesc: "Anything affecting your community",

  // ── Home: accountability ──
  accBadge: "Built for accountability",
  accTitle: "Every request should have a next step.",
  accText:
    "Your reference ID connects the original report to its status updates. Location, evidence, and progress notes help public teams understand the issue and make better decisions.",
  accStep1Title: "Keep your reference ID",
  accStep1Text: "Use it to find a request anytime.",
  accStep2Title: "Watch the timeline",
  accStep2Text: "See meaningful status changes.",

  // ── Home (redesigned 2026-10): hero ──
  heroBadge: "AI-Assisted Civic Grievance Portal",
  heroTitle: "Every grievance deserves a clear next step.",
  heroSubtitle:
    "Report public and civic infrastructure problems with exact location and evidence. Follow your issue through a transparent, verified lifecycle where authorized officers make the final decisions.",
  heroCtaReport: "Report a Grievance",
  heroCtaTrack: "Track Existing Grievance",
  heroTrustHuman: "Human-in-the-loop decisions",
  heroTrustGps: "GPS location verified",
  heroTrustAudit: "Recorded audit trail",

  // ── Home: how it works ──
  ovBadge: "How it works",
  ovTitle: "From report to resolution in 3 stages",
  ovText: "Clear accountability at every step without confusing administrative layers.",
  ovStageN: "Stage {n}",
  ovActorCitizen: "Citizen",
  ovActorAiOfficer: "AI + Officer",
  ovActorResolverCitizen: "Resolver & Citizen",
  ov1Title: "Submit with Details",
  ov1Text:
    "Describe the problem, pin your current GPS location, and optionally attach a photo. You immediately receive an official reference ID.",
  ov2Title: "Review & Assign",
  ov2Text:
    "AI categorizes and suggests urgency. An authorized department manager verifies the report and assigns a field employee to take charge.",
  ov3Title: "Track & Resolve",
  ov3Text:
    "The employee works on site, posts verified progress updates with optional completion photos, and submits for final manager closure.",

  // ── Home: category explorer ──
  catBadge: "Category explorer",
  catTitle: "What civic problem can we help resolve?",
  catText:
    "Select an issue category below to jump straight to the submission form with that department preselected, or choose “Other” if unsure.",
  catOpenForm: "Open general registration form",
  catReport: "Report",
  catCommon: "Common issues:",
  catWaterName: "Water & Sanitation",
  catWaterDesc: "Supply leaks, sewage blockage, contamination, and garbage disposal.",
  catWaterEx1: "Broken water mains",
  catWaterEx2: "Drainage overflow",
  catWaterEx3: "Uncollected solid waste",
  catRoadsName: "Roads & Transport",
  catRoadsDesc: "Potholes, damaged pavements, road signals, and public bus transit.",
  catRoadsEx1: "Pothole hazards",
  catRoadsEx2: "Defective traffic signals",
  catRoadsEx3: "Encroached footpaths",
  catElectricityName: "Electricity & Power",
  catElectricityDesc: "Power outages, broken transformers, hazardous lines, and street lighting.",
  catElectricityEx1: "Dark streetlights",
  catElectricityEx2: "Hanging wires",
  catElectricityEx3: "Frequent voltage fluctuations",
  catHealthName: "Health Services",
  catHealthDesc: "Public health facilities, vector disease control, and sanitation hygiene.",
  catHealthEx1: "Hospital cleanliness",
  catHealthEx2: "Mosquito fogging required",
  catHealthEx3: "Dispensary staff issue",
  catGovName: "Civic Governance",
  catGovDesc: "Certificates, municipal administrative services, and municipal approvals.",
  catGovEx1: "Delayed civil certificates",
  catGovEx2: "Tax payment queries",
  catGovEx3: "Ward office grievances",
  catOtherName: "Other Public Issues",
  catOtherDesc: "Community matters, parks, noise complaints, or unclassified public problems.",
  catOtherEx1: "Park maintenance",
  catOtherEx2: "Stray animal safety",
  catOtherEx3: "Public property damage",

  // ── Home: grievance lifecycle ──
  lcBadge: "Grievance lifecycle",
  lcTitle: "What happens after you submit?",
  lcText: "Every status corresponds to a real stage in the departmental workflow.",
  lcTimeline: "Expected timeline",
  lcActorAi: "AI System",
  lcActorManager: "Department Manager",
  lcActorResolver: "Field Resolver",
  lcActorManagerCitizen: "Manager & Citizen",
  lc1Title: "Submitted",
  lc1Text: "You register the complaint with title, description, GPS location, and optional photo.",
  lc1Sla: "Immediate reference ID",
  lc2Title: "Assisted Triage",
  lc2Text:
    "Keywords, priority estimate, and preliminary department routing are suggested for review.",
  lc2Sla: "Instant classification",
  lc3Title: "Assigned",
  lc3Text: "An authorized officer confirms the department and assigns an active field resolver.",
  lc3Sla: "1 – 2 working days",
  lc4Title: "In Progress",
  lc4Text:
    "The assigned worker reviews the issue, updates progress notes, and completes physical work.",
  lc4Sla: "Per department SLA",
  lc5Title: "Reviewed & Resolved",
  lc5Text: "Completion evidence is verified before closure. Citizens can inspect updates or reopen.",
  lc5Sla: "Resolution confirmation",
  lcDelayedTitle: "Need to check on a delayed or unresolved grievance?",
  lcDelayedText1: "Use your reference ID in the",
  lcTrackPortal: "Track Status portal",
  // Note: lcDelayedText2 intentionally starts with the sentence punctuation so
  // each script can control the join after the inline lcTrackPortal link.
  lcDelayedText2:
    ". If work is blocked or unsatisfactory, you can view the assigned officer notes and raise inquiries directly through your logged-in profile.",

  // ── Home: preparation checklist ──
  chkBadge: "Submission checklist",
  chkTitle: "Prepare before reporting",
  chkText:
    "To help municipal teams inspect and address your issue without unnecessary delays or clarification requests, please have these four items ready:",
  chkRequired: "Required",
  chkOptional: "Optional",
  chk1Title: "Clear Problem Description",
  chk1Text:
    "A concise title and detailed explanation of what is broken, how long it has persisted, and who is affected.",
  chk2Title: "Exact Location Pinned",
  chk2Text:
    "GPS coordinates or exact street address with nearest landmark so the field team can locate it.",
  chk3Title: "Supporting Photo / Evidence",
  chk3Text:
    "An optional photo (JPEG/PNG under 10MB) showing the damage or issue. Helps verify urgency quickly.",
  chk4Title: "Active Contact for Status",
  chk4Text:
    "Sign in with your mobile or email to track history across sessions and receive SMS status milestones.",

  // ── Home: final call to action ──
  ctaTitle: "Ready to submit your grievance?",
  ctaText:
    "Submissions are free and recorded on the civic ledger. You can capture live GPS coordinates and upload a photo directly from your phone.",
  ctaPrimary: "Open Registration Form",
  ctaSecondary: "Already registered? Track with ID",

  // ── Home: accountability & technology ──
  trustBadge: "Accountability & Technology",
  trustTitle: "AI-assisted triage with human decisions",
  trustText: "Understanding where technology helps and where human officers remain fully in charge.",
  trust1Title: "AI Category Inference",
  trust1Text: "Analyzes issue text to suggest the right department and urgency score.",
  trust2Title: "Officer Review & Assignment",
  trust2Text: "Department managers confirm routing and assign specific personnel to investigate.",
  trust3Title: "Recorded Progress Notes",
  trust3Text: "Every field inspection and progress update is permanently attached to the ticket.",
  trust4Title: "Verified Completion",
  trust4Text: "Resolutions require manager sign-off and completion evidence before closing.",

  // ── Home: track panel ──
  hpTitle: "Track Your Grievance",
  hpSubtitle: "Check real-time status and officer updates",
  hpLabel: "Grievance Reference ID",
  hpPlaceholder: "e.g. GRV-2026-0001",
  hpBtn: "Track",
  hpBtnBusy: "Checking…",
  hpHint: "Sent via SMS/email at registration.",
  hpTrySample: "Try sample",
  hpErrEmpty: "Please enter a grievance reference ID.",
  hpErrShort: "Reference ID looks too short (e.g. GRV-2026-0001).",
  hpErrNotFound: "No grievance record found for reference “{id}”. Please verify the ID.",
  hpErrMockNotFound: "Reference “{id}” not found in demo records.",
  hpErrOwned: "This grievance belongs to an account. Sign in to view its detailed timeline.",
  hpErrForbidden:
    "Access restricted. You must be signed in with the account that registered this grievance.",
  hpErrUnavailable: "Unable to retrieve grievance status right now. Please try again.",
  hpDept: "Dept:",
  hpViewTimeline: "View full activity timeline",
  hpNoFileYet: "Haven't filed a grievance yet?",
  hpRegisterNow: "Register now →",

  // ── Request lifecycle ──
  lifeBadge: "A clear path from report to resolution",
  lifeTitle: "Know what happens next",
  lifeText:
    "Your request moves through a visible lifecycle. AI helps officers organize the queue; people remain responsible for assignment, action, and closure.",
  lifeStageOf: "Stage {n} of {total}",
  lifeStageAria: "Show lifecycle stage: {label}",
  life1Label: "Submitted",
  life1Short: "You report it",
  life1Text: "Share what happened, add a photo, and pin the exact location.",
  life2Label: "Reviewed",
  life2Short: "We understand it",
  life2Text:
    "AI-assisted triage suggests the category and urgency for officer review.",
  life3Label: "Assigned",
  life3Short: "A team takes it",
  life3Text:
    "An authorized department manager routes your request to the right officer.",
  life4Label: "In progress",
  life4Short: "Work begins",
  life4Text: "The assigned team records updates, next steps, and expected timing.",
  life5Label: "Resolved",
  life5Short: "You see the outcome",
  life5Text:
    "The resolution is reviewed and the final status remains visible to you.",

  // ── Submit form ──
  complaintDetails: "Complaint Details",
  formSubtitle:
    "Fields marked * are required. We suggest a department and priority, which an officer reviews.",
  formTitleLabel: "Issue title",
  formTitlePlaceholder:
    "e.g. Broken water pipe flooding the road near Sector 12",
  formDescLabel: "Describe the issue",
  formDescPlaceholder:
    "Tell us what happened, the street or nearest landmark, how long it has been going on, and who it affects...",
  formDeptLabel: "Suggested department (optional)",
  formDeptHint:
    "Optional. An officer confirms the final department.",
  formAutoClassify: "Not sure? Choose for me",
  errTitleShort: "Please add a short title of at least 5 characters.",
  errDescShort: "Please describe the issue in at least 20 characters.",
  errLocationRequired: "Please add the location — tap “Use my current location”.",
  errSubmitFailed:
    "Submission failed. Please verify your connection or try again.",
  btnSubmitting: "Submitting…",
  resultTitle: "Grievance Successfully Registered",
  resultSubtitle: "Save this reference ID to track your complaint.",
  refIdLabel: "Reference ID",

  // ── Image upload ──
  imgLabel: "Photo of the issue",
  imgHint: "Optional. JPG or PNG, up to 10 MB.",
  imgBadType: "Please choose a JPG, PNG, or WebP image.",
  imgTooBig: "Image must be smaller than 10 MB.",
  imgNotConfigured:
    "Image upload is not configured in this demo — continuing without a photo.",
  imgUploading: "Uploading…",
  imgValidating: "Validating image…",
  imgProcessing: "Processing image validation…",
  imgRejected: "Image rejected: {reason}. Try another photo.",
  imgRejectedDefault: "not relevant to a public grievance",
  imgAccepted: "Image accepted.",
  imgAcceptedScore: "Image accepted (validation score {score}).",
  imgUploadFailed: "Upload failed: {message}",
  imgUploadUnknown: "Upload failed: unknown error",

  // ── Location capture ──
  incidentLocation: "Issue location",
  locHint:
    "Mark where the issue happened, not where you are now. This helps the right team find it faster.",
  locBusy: "Getting your location…",
  locPin: "Use my current location",
  locPinned: "✓ Location Verified & Pinned",
  locRetry: "Retry Location",
  locPinnedLabel: "Location pinned:",
  locDenied: "Permission denied — allow location access in your browser.",
  locCaptured: "✓ Current location added",
  locCloseMap: "Close map",
  locChooseMap: "Pick the place on a map (optional)",
  locPopupOrigin: "Your current location",
  locPopupDrag: "Drag this pin to the exact grievance location",
  locClickMap: "Click the map to place a pin.",
  locDragPin: "Drag the pin for precision.",
  locOutOfRange: "Choose a grievance location within {km} km of your current location.",
  locExact: "Exact grievance location: {coords}",
  locNotSelected:
    "No separate grievance location selected; your current location will be used.",
  locCaptureFirst:
    "Capture your current location first to enable the optional grievance-location picker.",

  // ── Track page ──
  trackTitle: "Track Grievance Status",
  trackSubtitle: "See your submitted grievances in one place.",
  myGrievances: "My grievances",
  // TODO i18n (DEC-028): reference-ID search was removed from citizen
  // surfaces. searchById/trackFind*/trackQuerying/trackNotFound*/byDept*/
  // myByDept*/hp* and the track tab switcher are now unreferenced; kept so
  // all 11 packs stay in sync.
  searchById: "Search by ID",
  search: "Search",
  trackFindTitle: "Find a grievance by reference ID",
  trackFindHint: "Use the ID from your acknowledgement, for example",
  btnSearching: "Searching…",
  trackQuerying: "Querying grievance database…",
  timelineTitle: "Resolution Timeline",
  timelineSubtitle: "Updated as officers take actions",
  trackNotFoundTitle: "No grievance found for that reference ID",
  trackNotFoundHint:
    "Check the exact reference code from your acknowledgement. You can only view requests your account is authorized to access.",
  byDeptTitle: "Requests by department",
  byDeptText:
    "Total requests in the registry. Individual request details remain access-controlled.",
  requestOne: "request",
  requestMany: "requests",
  signinTrackTitle: "Sign in to check status",
  signinTrackText:
    "Your personal grievance history is available after you sign in. This keeps your requests and updates private.",
  signinTrackBtn: "Sign in to view my grievances",
  myGrievancesText:
    "Your submitted requests and their latest known status.",
  totalLabel: "total",
  noGrievancesTitle: "No grievances found",
  noGrievancesHint: "Once you submit a complaint, it will appear here.",
  myByDeptTitle: "Grievances by department",
  myByDeptText:
    "A quick view of the requests currently available to your account.",

  // ── Department names ──
  dnameWater: "Water",
  dnameRoads: "Roads",
  dnameTransport: "Transport",
  dnameElectricity: "Electricity",
  dnameSanitation: "Sanitation",
  dnameHealth: "Health",
  dnameGovernance: "Governance",
  dnameOther: "Other",

  // ── My grievances (submit page) ──
  mySigninTitle: "Sign in to see your grievances",
  mySigninHint: "Your submissions and their live status will appear here.",
  yourGrievances: "Your Grievances",
  trackByRef: "Track by reference ID →",
  noGrievYetTitle: "No grievances yet",
  noGrievYetHint: "Complaints you submit will appear here.",
  checkingSession: "Checking sign-in…",
  signinToSubmitTitle: "Sign in to lodge a complaint",
  signinToSubmitText:
    "Your account lets us connect the request to you and show its progress securely.",
  signinToContinue: "Sign in to continue",
  signinToSubmitHint: "New here? You can create an account in under a minute.",
  registerSubtitle: "Register a Public Grievance",
  submitPageDesc:
    "Describe the issue, attach evidence, and pin your location. AI-assisted routing ensures your complaint reaches the right department.",

  // ── Login ──
  securePortal: "Secure portal",
  loginSubLive: "Official portal access for citizens and officers.",
  loginSubDemo: "Sign in with your official account credentials.",
  errEnterCreds: "Enter your email and password.",
  nameLabel: "Full name",
  emailLabel: "Email",
  passwordLabel: "Password",
  rememberMe: "Remember me",
  errInvalidCreds: "Invalid email or password.",
  errGoogleCancelled: "Google authentication was cancelled.",
  errGoogleFailed: "Failed to verify credentials with Google.",
  errSignIn: "Sign in error: {reason}",
  forgotPassword: "Forgot password?",
  btnSigningIn: "Signing in...",
  orContinueWith: "Or continue with",
  googleSignIn: "Sign in with Google",
  googleSignUp: "Sign up with Google",
  newHere: "New here?",
  showPassword: "Show password",
  hidePassword: "Hide password",
  loading: "Loading...",

  // ── Register ──
  regSubLive: "Official citizen account registration.",
  regSubDemo: "Sign up for official citizen portal access.",
  errFillAll: "Fill in all fields to create your account.",
  errPasswordLen: "Password must be at least 8 characters.",
  errRegisterFailed: "Failed to register account.",
  passwordHint: "At least 8 characters.",
  btnCreating: "Creating account...",
  btnCreateAccount: "Create account",
  alreadyRegistered: "Already registered?",

  // ── AI analysis panel ──
  aiSuggestion: "AI Suggestion",
  autoGenerated: "Auto-generated",
  aiSure: "AI is {pct}% sure",
  keyWordsSpotted: "Key words spotted:",

  // ── Status timeline ──
  progressTimeline: "Progress timeline",
  rejectedTitle: "Ticket Rejected / Closed without Action",
  rejectedText:
    "This submission did not meet municipal verification criteria or was flagged as a duplicate.",
  msSubmittedTitle: "Complaint Registered",
  msSubmittedDesc: "Acknowledged and logged into municipal registry.",
  msTriagedTitle: "Department Assigned",
  msTriagedDesc: "Department routing, priority, and sentiment evaluated.",
  msAssignedTitle: "Officer Assigned",
  msAssignedDesc: "Allocated to designated nodal officer or department team.",
  msInProgressTitle: "Remediation In Progress",
  msInProgressDesc:
    "Field inspection, on-site repairs, or civic action underway.",
  msResolvedTitle: "Resolved & Verified",
  msResolvedDesc:
    "Remediation verified and ticket closed by authorized officer.",

  // ── Badges ──
  priorityHigh: "High priority",
  priorityMedium: "Medium priority",
  priorityLow: "Low priority",
  statusSubmitted: "Submitted",
  statusOpen: "Open",
  statusTriaged: "Triaged",
  statusPendingAssignment: "Pending assignment",
  statusAiProcessing: "AI processing",
  statusAssigned: "Assigned",
  statusInProgress: "In progress",
  statusBlocked: "Blocked",
  statusEscalated: "Escalated",
  statusUnderReview: "Under review",
  statusResolutionSubmitted: "Resolution submitted",
  statusResolved: "Resolved",
  statusClosed: "Closed",
  statusRejected: "Rejected",

  // ── Profile / face sign-in (DEC-024) ──
  profile: "Profile",
  profileTitle: "Your profile",
  profileSub: "Manage your account and sign-in preferences.",
  faceSignInTab: "Face sign-in",
  faceTwoFactorTitle: "Face verification",
  faceTwoFactorSub: "Your password was accepted. Verify your face to finish signing in.",
  faceVerifyBtn: "Verify with face",
  faceSkipBtn: "Continue without face",
  backToSignIn: "Back to sign in",
  faceStart: "Start face sign-in",
  faceLoginHint: "Works for accounts with an enrolled face. Use a verified mobile number or your Citizen ID; verify an unverified number from Profile first.",
  faceChallengePrompt: "Look at the camera and {action}.",
  faceActTurnLeft: "turn your head left",
  faceActTurnRight: "turn your head right",
  faceActBlink: "blink your eyes",
  faceActSmile: "smile",
  faceCapture: "Capture frames",
  faceCapturing: "Capturing…",
  faceCaptured: "Frames captured",
  faceVerifying: "Verifying your face…",
  faceVerifyingHint: "Checking liveness and biometric template match.",
  faceRetry: "Try camera again",
  faceCameraPreview: "Live camera preview",
  faceCameraDenied:
    "Camera access was denied. Allow the camera for this site in your browser settings and try again.",
  faceCameraMissing: "No camera was found on this device.",
  faceCameraTimeout:
    "The camera took too long to start. Close other apps using the camera and try again.",
  faceCameraError: "Could not start the camera on this device.",
  faceUnavailable: "Face sign-in is unavailable right now. Please try again later.",
  faceEnrollTitle: "Face sign-in",
  faceEnrollDesc:
    "Enroll your face to sign in with your camera. Your template is stored encrypted, used only to verify it is you, and can be deleted here at any time.",
  faceConsentLabel:
    "I consent to my face template being stored, encrypted, for sign-in.",
  faceConsentRequired: "Consent is required before enrolling a face template.",
  faceEnrollBtn: "Enroll face",
  faceReenrollBtn: "Re-enroll face",
  faceDeleteBtn: "Delete face data",
  faceDeleteConfirm:
    "Delete your stored face template? You will lose face sign-in until you enroll again.",
  faceEnrolledBadge: "Face enrolled",
  faceNotEnrolledBadge: "No face enrolled",
  faceRequire2faLabel: "Also ask for face verification after my password sign-in",
  faceRequire2faHint:
    "Optional extra step for admin accounts. Password and Google sign-in still work — you can skip the face step.",
  faceRequire2faSave: "Save face settings",
  faceReenrollHint:
    "Face sign-in stopped recognizing you — for example after a model update? Re-enroll your face; a model change never locks you out.",
  faceEnrolledNotice: "Face enrolled. You can now sign in with your face.",
  faceReenrolledNotice: "Face re-enrolled successfully.",
  faceDeletedNotice: "Face data deleted.",
  faceSavedNotice: "Face settings saved.",
  faceDemoNote:
    "Face sign-in settings need the live backend (NEXT_PUBLIC_USE_MOCKS=false).",
  faceSignupTitle: "Sign up with your face",
  faceSignupSub: "Register for municipal grievance services without a password",
  fullNameLabel: "Full name",
  mobileLabel: "Mobile number",
  smsConsentLabel: "I agree to receive optional SMS updates about this grievance. I can withdraw consent in my profile.",
  phoneSectionTitle: "Mobile number & SMS updates",
  phoneSectionDesc: "Verify your number before using it for face sign-in. SMS updates are optional and separate from biometric consent.",
  phoneCurrentLabel: "Current number",
  phoneNotLinked: "Not linked",
  phoneVerifiedBadge: "Verified",
  phoneSendCode: "Send verification code",
  phoneCodePlaceholder: "6-digit code",
  phoneLinkAction: "Verify & link",
  phoneUnlinkAction: "Verify & unlink",
  phoneSmsOptIn: "Receive optional grievance updates by SMS.",
  phoneLinkedNotice: "Mobile number verified and linked.",
  phoneUnlinkedNotice: "Mobile number unlinked.",
  phoneDigitsHint: "+91 · 10-digit Indian mobile number",
  faceConsentText: "I consent to capturing and storing my facial biometric data solely for authentication and grievance services.",
  faceCaptureStep: "Look at the camera and follow the prompt",
  signupSuccessTitle: "Registration Successful!",
  signupSuccessSub: "Your face login account has been created.",
  yourCitizenId: "Your Citizen ID",
  citizenIdSaveHint: "Save this ID, you can use it or your mobile number to sign in.",
  copyCitizenId: "Copy Citizen ID",
  copied: "Copied!",
  goToCitizenPortal: "Continue to Citizen Portal",
  newHereFaceSignup: "New here? Sign up with your face",
  tryAgain: "Try again",
  faceOfficeResetNotice: "Please visit the municipal office to reset your face login.",
  faceIdentifierLabel: "Mobile number or Citizen ID",
  faceIdentifierPlaceholder: "Enter 10-digit mobile number or CIT-XXXXXXXX",
  faceMaxFailsOfficeReset: "Could not verify your face. Please visit the municipal office to reset your face login.",
  faceReenrollRequired: "Biometric update required. Please visit the municipal office to re-enroll your face login.",
  faceDeleteWarningFaceOnly: "Deleting your face data removes your only way to sign in. You will need to visit the municipal office to reset your face login.",
  faceReenrollTitle: "Re-enroll face login",
  faceReenrollSub: "Enter the one-time token issued by municipal staff to re-enroll your face",
  reenrollTokenLabel: "Re-enrollment token",
  reenrollTokenPlaceholder: "Paste the token provided by municipal staff",
  reEnrollBtn: "Re-enroll Face",
  reEnrollSuccess: "Face re-enrolled successfully! You can now sign in.",
  haveRecoveryToken: "Have a recovery token? Re-enroll here",
  adminResetFaceBtn: "Reset face login",
  adminResetTokenGenerated: "One-time re-enrollment token generated (valid 24h). Provide this to the citizen in person:",
};

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export default en as Messages;
