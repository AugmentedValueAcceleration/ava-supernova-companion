type TranslationKey =
  | 'chat' | 'tasks' | 'journal' | 'settings' | 'newChat' | 'chatHistory'
  | 'messagePlaceholder' | 'noConversations' | 'startChatting'
  | 'account' | 'guest' | 'guestSubtitle' | 'signIn' | 'signOut'
  | 'viewPlans' | 'upgradePlan' | 'disconnectKey'
  | 'model' | 'defaultModel' | 'appearance' | 'theme' | 'textSize'
  | 'dark' | 'light' | 'system'
  | 'data' | 'clearChat' | 'clearTasks' | 'clearJournal' | 'areYouSure' | 'clear' | 'cancel'
  | 'about' | 'version' | 'website' | 'termsOfService' | 'privacyPolicy'
  | 'localOnly' | 'synced' | 'memory'
  | 'addTask' | 'taskTitle' | 'noTasks' | 'today' | 'all' | 'overdue' | 'completed'
  | 'yourJournal' | 'avasJournal' | 'writeEntry' | 'noEntry' | 'avaNoEntry' | 'avaWrites'
  | 'saveEntry' | 'mood' | 'howAreYou'
  | 'welcome' | 'welcomeSubtitle' | 'getStarted' | 'skip'
  | 'language' | 'delete' | 'deleteConfirm' | 'tapToEdit' | 'nothingToday' | 'noActiveTasks' | 'addTaskHint';

type Translations = Record<TranslationKey, string>;

const translations: Record<string, Translations> = {
  en: {
    chat: 'Chat', tasks: 'Tasks', journal: 'Journal', settings: 'Settings',
    newChat: 'New chat', chatHistory: 'Chat History',
    messagePlaceholder: 'Message Ava...', noConversations: 'No conversations yet', startChatting: 'Start chatting with Ava',
    account: 'ACCOUNT', guest: 'Guest', guestSubtitle: 'Local data only — sign in to sync across devices',
    signIn: 'Sign In / Create Account', signOut: 'Sign Out', viewPlans: 'View plans & pricing',
    upgradePlan: 'Upgrade Plan', disconnectKey: 'Disconnect API Key',
    model: 'MODEL', defaultModel: 'Default model',
    appearance: 'APPEARANCE', theme: 'Theme', textSize: 'Text size',
    dark: 'Dark', light: 'Light', system: 'System',
    data: 'DATA', clearChat: 'Clear chat history', clearTasks: 'Clear local tasks',
    clearJournal: 'Clear local journal', areYouSure: 'Are you sure?', clear: 'Clear', cancel: 'Cancel',
    about: 'ABOUT', version: 'Version', website: 'Website', termsOfService: 'Terms of Service', privacyPolicy: 'Privacy Policy',
    localOnly: 'Local only — sign in to sync', synced: 'Synced', memory: 'Memory',
    addTask: 'Add task', taskTitle: 'Task title', noTasks: 'No tasks yet', today: 'Today', all: 'All', overdue: 'Overdue', completed: 'Completed',
    yourJournal: 'Your Journal', avasJournal: "Ava's Journal", writeEntry: 'Write Entry',
    noEntry: 'No entry for this day', avaNoEntry: "Ava hasn't written anything for this day",
    avaWrites: 'Ava writes her thoughts at the end of sessions',
    saveEntry: 'Save Entry', mood: 'Mood', howAreYou: 'How are you feeling? What happened today? Write freely...',
    welcome: 'Welcome to Ava', welcomeSubtitle: 'Your AI companion, everywhere', getStarted: 'Get Started', skip: 'Skip',
    language: 'Language', delete: 'Delete', deleteConfirm: 'Delete this?', tapToEdit: 'Tap to edit', nothingToday: 'Nothing for today', noActiveTasks: 'No active tasks', addTaskHint: 'Add a task above or ask Ava',
  },
  es: {
    chat: 'Chat', tasks: 'Tareas', journal: 'Diario', settings: 'Ajustes',
    newChat: 'Nuevo chat', chatHistory: 'Historial',
    messagePlaceholder: 'Mensaje a Ava...', noConversations: 'Sin conversaciones', startChatting: 'Empieza a chatear con Ava',
    account: 'CUENTA', guest: 'Invitado', guestSubtitle: 'Datos locales — inicia sesión para sincronizar',
    signIn: 'Iniciar sesión / Crear cuenta', signOut: 'Cerrar sesión', viewPlans: 'Ver planes y precios',
    upgradePlan: 'Mejorar plan', disconnectKey: 'Desconectar clave API',
    model: 'MODELO', defaultModel: 'Modelo predeterminado',
    appearance: 'APARIENCIA', theme: 'Tema', textSize: 'Tamaño de texto',
    dark: 'Oscuro', light: 'Claro', system: 'Sistema',
    data: 'DATOS', clearChat: 'Borrar historial de chat', clearTasks: 'Borrar tareas locales',
    clearJournal: 'Borrar diario local', areYouSure: '¿Estás seguro?', clear: 'Borrar', cancel: 'Cancelar',
    about: 'ACERCA DE', version: 'Versión', website: 'Sitio web', termsOfService: 'Términos de servicio', privacyPolicy: 'Política de privacidad',
    localOnly: 'Solo local — inicia sesión para sincronizar', synced: 'Sincronizado', memory: 'Memoria',
    addTask: 'Añadir tarea', taskTitle: 'Título de tarea', noTasks: 'Sin tareas', today: 'Hoy', all: 'Todas', overdue: 'Vencidas', completed: 'Completadas',
    yourJournal: 'Tu diario', avasJournal: 'Diario de Ava', writeEntry: 'Escribir entrada',
    noEntry: 'Sin entrada para este día', avaNoEntry: 'Ava no ha escrito nada hoy',
    avaWrites: 'Ava escribe sus pensamientos al final de las sesiones',
    saveEntry: 'Guardar', mood: 'Ánimo', howAreYou: '¿Cómo te sientes? ¿Qué pasó hoy? Escribe libremente...',
    welcome: 'Bienvenido a Ava', welcomeSubtitle: 'Tu compañera IA, en todas partes', getStarted: 'Empezar', skip: 'Omitir',
    language: 'Idioma', delete: 'Eliminar', deleteConfirm: '¿Eliminar esto?', tapToEdit: 'Toca para editar', nothingToday: 'Nada para hoy', noActiveTasks: 'Sin tareas activas', addTaskHint: 'Añade una tarea o pregunta a Ava',
  },
  fr: {
    chat: 'Chat', tasks: 'Tâches', journal: 'Journal', settings: 'Paramètres',
    newChat: 'Nouveau chat', chatHistory: 'Historique',
    messagePlaceholder: 'Message à Ava...', noConversations: 'Aucune conversation', startChatting: 'Commencez à discuter avec Ava',
    account: 'COMPTE', guest: 'Invité', guestSubtitle: 'Données locales — connectez-vous pour synchroniser',
    signIn: 'Se connecter / Créer un compte', signOut: 'Se déconnecter', viewPlans: 'Voir les plans et tarifs',
    upgradePlan: 'Améliorer le plan', disconnectKey: 'Déconnecter la clé API',
    model: 'MODÈLE', defaultModel: 'Modèle par défaut',
    appearance: 'APPARENCE', theme: 'Thème', textSize: 'Taille du texte',
    dark: 'Sombre', light: 'Clair', system: 'Système',
    data: 'DONNÉES', clearChat: "Effacer l'historique", clearTasks: 'Effacer les tâches locales',
    clearJournal: 'Effacer le journal local', areYouSure: 'Êtes-vous sûr ?', clear: 'Effacer', cancel: 'Annuler',
    about: 'À PROPOS', version: 'Version', website: 'Site web', termsOfService: "Conditions d'utilisation", privacyPolicy: 'Politique de confidentialité',
    localOnly: 'Local uniquement — connectez-vous pour synchroniser', synced: 'Synchronisé', memory: 'Mémoire',
    addTask: 'Ajouter une tâche', taskTitle: 'Titre de la tâche', noTasks: 'Aucune tâche', today: "Aujourd'hui", all: 'Toutes', overdue: 'En retard', completed: 'Terminées',
    yourJournal: 'Votre journal', avasJournal: "Journal d'Ava", writeEntry: 'Écrire une entrée',
    noEntry: "Pas d'entrée pour ce jour", avaNoEntry: "Ava n'a rien écrit aujourd'hui",
    avaWrites: 'Ava écrit ses pensées à la fin des sessions',
    saveEntry: 'Enregistrer', mood: 'Humeur', howAreYou: 'Comment vous sentez-vous ? Que s\'est-il passé aujourd\'hui ?',
    welcome: 'Bienvenue sur Ava', welcomeSubtitle: 'Votre compagnon IA, partout', getStarted: 'Commencer', skip: 'Passer',
    language: 'Langue', delete: 'Supprimer', deleteConfirm: 'Supprimer ceci ?', tapToEdit: 'Appuyez pour modifier', nothingToday: "Rien pour aujourd'hui", noActiveTasks: 'Aucune tâche active', addTaskHint: 'Ajoutez une tâche ou demandez à Ava',
  },
  de: {
    chat: 'Chat', tasks: 'Aufgaben', journal: 'Tagebuch', settings: 'Einstellungen',
    newChat: 'Neuer Chat', chatHistory: 'Chatverlauf',
    messagePlaceholder: 'Nachricht an Ava...', noConversations: 'Keine Unterhaltungen', startChatting: 'Starte einen Chat mit Ava',
    account: 'KONTO', guest: 'Gast', guestSubtitle: 'Nur lokal — melde dich an zum Synchronisieren',
    signIn: 'Anmelden / Konto erstellen', signOut: 'Abmelden', viewPlans: 'Pläne und Preise',
    upgradePlan: 'Plan upgraden', disconnectKey: 'API-Schlüssel trennen',
    model: 'MODELL', defaultModel: 'Standardmodell',
    appearance: 'DARSTELLUNG', theme: 'Design', textSize: 'Textgröße',
    dark: 'Dunkel', light: 'Hell', system: 'System',
    data: 'DATEN', clearChat: 'Chatverlauf löschen', clearTasks: 'Lokale Aufgaben löschen',
    clearJournal: 'Lokales Tagebuch löschen', areYouSure: 'Bist du sicher?', clear: 'Löschen', cancel: 'Abbrechen',
    about: 'ÜBER', version: 'Version', website: 'Webseite', termsOfService: 'Nutzungsbedingungen', privacyPolicy: 'Datenschutz',
    localOnly: 'Nur lokal — anmelden zum Synchronisieren', synced: 'Synchronisiert', memory: 'Erinnerung',
    addTask: 'Aufgabe hinzufügen', taskTitle: 'Aufgabentitel', noTasks: 'Keine Aufgaben', today: 'Heute', all: 'Alle', overdue: 'Überfällig', completed: 'Erledigt',
    yourJournal: 'Dein Tagebuch', avasJournal: 'Avas Tagebuch', writeEntry: 'Eintrag schreiben',
    noEntry: 'Kein Eintrag für diesen Tag', avaNoEntry: 'Ava hat heute nichts geschrieben',
    avaWrites: 'Ava schreibt ihre Gedanken am Ende der Sitzungen',
    saveEntry: 'Speichern', mood: 'Stimmung', howAreYou: 'Wie fühlst du dich? Was ist heute passiert?',
    welcome: 'Willkommen bei Ava', welcomeSubtitle: 'Dein KI-Begleiter, überall', getStarted: 'Loslegen', skip: 'Überspringen',
    language: 'Sprache', delete: 'Löschen', deleteConfirm: 'Löschen?', tapToEdit: 'Tippen zum Bearbeiten', nothingToday: 'Nichts für heute', noActiveTasks: 'Keine aktiven Aufgaben', addTaskHint: 'Aufgabe hinzufügen oder Ava fragen',
  },
  ja: {
    chat: 'チャット', tasks: 'タスク', journal: 'ジャーナル', settings: '設定',
    newChat: '新しいチャット', chatHistory: '履歴',
    messagePlaceholder: 'Avaにメッセージ...', noConversations: '会話がありません', startChatting: 'Avaとチャットを始めましょう',
    account: 'アカウント', guest: 'ゲスト', guestSubtitle: 'ローカルのみ — ログインして同期',
    signIn: 'ログイン / アカウント作成', signOut: 'ログアウト', viewPlans: 'プランと料金',
    upgradePlan: 'プランをアップグレード', disconnectKey: 'APIキーを切断',
    model: 'モデル', defaultModel: 'デフォルトモデル',
    appearance: '外観', theme: 'テーマ', textSize: 'テキストサイズ',
    dark: 'ダーク', light: 'ライト', system: 'システム',
    data: 'データ', clearChat: 'チャット履歴を削除', clearTasks: 'ローカルタスクを削除',
    clearJournal: 'ローカルジャーナルを削除', areYouSure: '本当ですか？', clear: '削除', cancel: 'キャンセル',
    about: 'このアプリについて', version: 'バージョン', website: 'ウェブサイト', termsOfService: '利用規約', privacyPolicy: 'プライバシーポリシー',
    localOnly: 'ローカルのみ — ログインして同期', synced: '同期済み', memory: 'メモリ',
    addTask: 'タスクを追加', taskTitle: 'タスク名', noTasks: 'タスクがありません', today: '今日', all: 'すべて', overdue: '期限切れ', completed: '完了',
    yourJournal: 'あなたのジャーナル', avasJournal: 'Avaのジャーナル', writeEntry: 'エントリーを書く',
    noEntry: 'この日のエントリーはありません', avaNoEntry: 'Avaはまだ何も書いていません',
    avaWrites: 'Avaはセッション終了時に考えを書きます',
    saveEntry: '保存', mood: '気分', howAreYou: '今日はどうでしたか？自由に書いてください...',
    welcome: 'Avaへようこそ', welcomeSubtitle: 'あなたのAIコンパニオン', getStarted: '始める', skip: 'スキップ',
    language: '言語', delete: '削除', deleteConfirm: '削除しますか？', tapToEdit: 'タップして編集', nothingToday: '今日の予定なし', noActiveTasks: 'アクティブなタスクなし', addTaskHint: 'タスクを追加するかAvaに聞いてください',
  },
  ko: {
    chat: '채팅', tasks: '작업', journal: '일기', settings: '설정',
    newChat: '새 채팅', chatHistory: '채팅 기록',
    messagePlaceholder: 'Ava에게 메시지...', noConversations: '대화 없음', startChatting: 'Ava와 대화를 시작하세요',
    account: '계정', guest: '게스트', guestSubtitle: '로컬 전용 — 로그인하여 동기화',
    signIn: '로그인 / 계정 만들기', signOut: '로그아웃', viewPlans: '요금제 보기',
    upgradePlan: '요금제 업그레이드', disconnectKey: 'API 키 연결 해제',
    model: '모델', defaultModel: '기본 모델',
    appearance: '외관', theme: '테마', textSize: '글자 크기',
    dark: '다크', light: '라이트', system: '시스템',
    data: '데이터', clearChat: '채팅 기록 삭제', clearTasks: '로컬 작업 삭제',
    clearJournal: '로컬 일기 삭제', areYouSure: '확실합니까?', clear: '삭제', cancel: '취소',
    about: '소개', version: '버전', website: '웹사이트', termsOfService: '이용약관', privacyPolicy: '개인정보처리방침',
    localOnly: '로컬 전용 — 로그인하여 동기화', synced: '동기화됨', memory: '메모리',
    addTask: '작업 추가', taskTitle: '작업 제목', noTasks: '작업 없음', today: '오늘', all: '전체', overdue: '기한 초과', completed: '완료',
    yourJournal: '내 일기', avasJournal: 'Ava의 일기', writeEntry: '작성하기',
    noEntry: '이 날의 항목 없음', avaNoEntry: 'Ava가 아직 작성하지 않았습니다',
    avaWrites: 'Ava는 세션 종료 시 생각을 기록합니다',
    saveEntry: '저장', mood: '기분', howAreYou: '오늘 기분이 어떠세요? 자유롭게 작성하세요...',
    welcome: 'Ava에 오신 것을 환영합니다', welcomeSubtitle: '어디서나 함께하는 AI 동반자', getStarted: '시작하기', skip: '건너뛰기',
    language: '언어', delete: '삭제', deleteConfirm: '삭제하시겠습니까?', tapToEdit: '탭하여 편집', nothingToday: '오늘 할 일 없음', noActiveTasks: '활성 작업 없음', addTaskHint: '작업을 추가하거나 Ava에게 물어보세요',
  },
  'zh-CN': {
    chat: '聊天', tasks: '任务', journal: '日记', settings: '设置',
    newChat: '新对话', chatHistory: '聊天记录',
    messagePlaceholder: '给Ava发消息...', noConversations: '没有对话', startChatting: '开始和Ava聊天',
    account: '账户', guest: '访客', guestSubtitle: '仅本地数据 — 登录以同步',
    signIn: '登录 / 创建账户', signOut: '退出登录', viewPlans: '查看方案与价格',
    upgradePlan: '升级方案', disconnectKey: '断开API密钥',
    model: '模型', defaultModel: '默认模型',
    appearance: '外观', theme: '主题', textSize: '字体大小',
    dark: '深色', light: '浅色', system: '系统',
    data: '数据', clearChat: '清除聊天记录', clearTasks: '清除本地任务',
    clearJournal: '清除本地日记', areYouSure: '确定吗？', clear: '清除', cancel: '取消',
    about: '关于', version: '版本', website: '网站', termsOfService: '服务条款', privacyPolicy: '隐私政策',
    localOnly: '仅本地 — 登录以同步', synced: '已同步', memory: '记忆',
    addTask: '添加任务', taskTitle: '任务标题', noTasks: '没有任务', today: '今天', all: '全部', overdue: '逾期', completed: '已完成',
    yourJournal: '你的日记', avasJournal: 'Ava的日记', writeEntry: '写日记',
    noEntry: '这一天没有记录', avaNoEntry: 'Ava还没有写任何东西',
    avaWrites: 'Ava在会话结束时记录她的想法',
    saveEntry: '保存', mood: '心情', howAreYou: '今天感觉怎么样？自由书写...',
    welcome: '欢迎来到Ava', welcomeSubtitle: '你的AI伙伴，随时随地', getStarted: '开始使用', skip: '跳过',
    language: '语言', delete: '删除', deleteConfirm: '确定删除？', tapToEdit: '点击编辑', nothingToday: '今天没有任务', noActiveTasks: '没有活跃任务', addTaskHint: '添加任务或问Ava',
  },
  pt: {
    chat: 'Chat', tasks: 'Tarefas', journal: 'Diário', settings: 'Configurações',
    newChat: 'Novo chat', chatHistory: 'Histórico',
    messagePlaceholder: 'Mensagem para Ava...', noConversations: 'Sem conversas', startChatting: 'Comece a conversar com Ava',
    account: 'CONTA', guest: 'Convidado', guestSubtitle: 'Dados locais — entre para sincronizar',
    signIn: 'Entrar / Criar conta', signOut: 'Sair', viewPlans: 'Ver planos e preços',
    upgradePlan: 'Atualizar plano', disconnectKey: 'Desconectar chave API',
    model: 'MODELO', defaultModel: 'Modelo padrão',
    appearance: 'APARÊNCIA', theme: 'Tema', textSize: 'Tamanho do texto',
    dark: 'Escuro', light: 'Claro', system: 'Sistema',
    data: 'DADOS', clearChat: 'Limpar histórico', clearTasks: 'Limpar tarefas locais',
    clearJournal: 'Limpar diário local', areYouSure: 'Tem certeza?', clear: 'Limpar', cancel: 'Cancelar',
    about: 'SOBRE', version: 'Versão', website: 'Site', termsOfService: 'Termos de serviço', privacyPolicy: 'Política de privacidade',
    localOnly: 'Apenas local — entre para sincronizar', synced: 'Sincronizado', memory: 'Memória',
    addTask: 'Adicionar tarefa', taskTitle: 'Título da tarefa', noTasks: 'Sem tarefas', today: 'Hoje', all: 'Todas', overdue: 'Atrasadas', completed: 'Concluídas',
    yourJournal: 'Seu diário', avasJournal: 'Diário da Ava', writeEntry: 'Escrever entrada',
    noEntry: 'Sem entrada para este dia', avaNoEntry: 'Ava não escreveu nada hoje',
    avaWrites: 'Ava escreve seus pensamentos no final das sessões',
    saveEntry: 'Salvar', mood: 'Humor', howAreYou: 'Como você está? O que aconteceu hoje?',
    welcome: 'Bem-vindo ao Ava', welcomeSubtitle: 'Seu companheiro IA, em qualquer lugar', getStarted: 'Começar', skip: 'Pular',
    language: 'Idioma', delete: 'Excluir', deleteConfirm: 'Excluir isto?', tapToEdit: 'Toque para editar', nothingToday: 'Nada para hoje', noActiveTasks: 'Sem tarefas ativas', addTaskHint: 'Adicione uma tarefa ou pergunte à Ava',
  },
  it: {
    chat: 'Chat', tasks: 'Compiti', journal: 'Diario', settings: 'Impostazioni',
    newChat: 'Nuova chat', chatHistory: 'Cronologia',
    messagePlaceholder: 'Messaggio ad Ava...', noConversations: 'Nessuna conversazione', startChatting: 'Inizia a chattare con Ava',
    account: 'ACCOUNT', guest: 'Ospite', guestSubtitle: 'Solo locale — accedi per sincronizzare',
    signIn: 'Accedi / Crea account', signOut: 'Esci', viewPlans: 'Vedi piani e prezzi',
    upgradePlan: 'Aggiorna piano', disconnectKey: 'Disconnetti chiave API',
    model: 'MODELLO', defaultModel: 'Modello predefinito',
    appearance: 'ASPETTO', theme: 'Tema', textSize: 'Dimensione testo',
    dark: 'Scuro', light: 'Chiaro', system: 'Sistema',
    data: 'DATI', clearChat: 'Cancella cronologia', clearTasks: 'Cancella compiti locali',
    clearJournal: 'Cancella diario locale', areYouSure: 'Sei sicuro?', clear: 'Cancella', cancel: 'Annulla',
    about: 'INFO', version: 'Versione', website: 'Sito web', termsOfService: "Termini di servizio", privacyPolicy: 'Privacy',
    localOnly: 'Solo locale — accedi per sincronizzare', synced: 'Sincronizzato', memory: 'Memoria',
    addTask: 'Aggiungi compito', taskTitle: 'Titolo compito', noTasks: 'Nessun compito', today: 'Oggi', all: 'Tutti', overdue: 'Scaduti', completed: 'Completati',
    yourJournal: 'Il tuo diario', avasJournal: 'Diario di Ava', writeEntry: 'Scrivi voce',
    noEntry: 'Nessuna voce per questo giorno', avaNoEntry: 'Ava non ha scritto nulla oggi',
    avaWrites: 'Ava scrive i suoi pensieri alla fine delle sessioni',
    saveEntry: 'Salva', mood: 'Umore', howAreYou: 'Come ti senti? Cosa è successo oggi?',
    welcome: 'Benvenuto su Ava', welcomeSubtitle: 'Il tuo compagno IA, ovunque', getStarted: 'Inizia', skip: 'Salta',
    language: 'Lingua', delete: 'Elimina', deleteConfirm: 'Eliminare?', tapToEdit: 'Tocca per modificare', nothingToday: 'Niente per oggi', noActiveTasks: 'Nessun compito attivo', addTaskHint: 'Aggiungi un compito o chiedi ad Ava',
  },
  ar: {
    chat: 'محادثة', tasks: 'المهام', journal: 'اليوميات', settings: 'الإعدادات',
    newChat: 'محادثة جديدة', chatHistory: 'السجل',
    messagePlaceholder: 'رسالة إلى آفا...', noConversations: 'لا توجد محادثات', startChatting: 'ابدأ الدردشة مع آفا',
    account: 'الحساب', guest: 'ضيف', guestSubtitle: 'بيانات محلية فقط — سجل دخول للمزامنة',
    signIn: 'تسجيل الدخول / إنشاء حساب', signOut: 'تسجيل الخروج', viewPlans: 'عرض الخطط والأسعار',
    upgradePlan: 'ترقية الخطة', disconnectKey: 'فصل مفتاح API',
    model: 'النموذج', defaultModel: 'النموذج الافتراضي',
    appearance: 'المظهر', theme: 'السمة', textSize: 'حجم النص',
    dark: 'داكن', light: 'فاتح', system: 'النظام',
    data: 'البيانات', clearChat: 'مسح سجل المحادثات', clearTasks: 'مسح المهام المحلية',
    clearJournal: 'مسح اليوميات المحلية', areYouSure: 'هل أنت متأكد؟', clear: 'مسح', cancel: 'إلغاء',
    about: 'حول', version: 'الإصدار', website: 'الموقع', termsOfService: 'شروط الخدمة', privacyPolicy: 'سياسة الخصوصية',
    localOnly: 'محلي فقط — سجل دخول للمزامنة', synced: 'مُزامن', memory: 'الذاكرة',
    addTask: 'إضافة مهمة', taskTitle: 'عنوان المهمة', noTasks: 'لا توجد مهام', today: 'اليوم', all: 'الكل', overdue: 'متأخرة', completed: 'مكتملة',
    yourJournal: 'يومياتك', avasJournal: 'يوميات آفا', writeEntry: 'كتابة مدخل',
    noEntry: 'لا يوجد مدخل لهذا اليوم', avaNoEntry: 'لم تكتب آفا شيئاً اليوم',
    avaWrites: 'تكتب آفا أفكارها في نهاية الجلسات',
    saveEntry: 'حفظ', mood: 'المزاج', howAreYou: 'كيف تشعر؟ ماذا حدث اليوم؟',
    welcome: 'مرحباً بك في آفا', welcomeSubtitle: 'رفيقك الذكي، في كل مكان', getStarted: 'ابدأ', skip: 'تخطي',
    language: 'اللغة', delete: 'حذف', deleteConfirm: 'حذف هذا؟', tapToEdit: 'اضغط للتعديل', nothingToday: 'لا شيء لليوم', noActiveTasks: 'لا توجد مهام نشطة', addTaskHint: 'أضف مهمة أو اسأل آفا',
  },
  hi: {
    chat: 'चैट', tasks: 'कार्य', journal: 'डायरी', settings: 'सेटिंग्स',
    newChat: 'नई चैट', chatHistory: 'इतिहास',
    messagePlaceholder: 'Ava को संदेश...', noConversations: 'कोई वार्तालाप नहीं', startChatting: 'Ava से चैट शुरू करें',
    account: 'खाता', guest: 'अतिथि', guestSubtitle: 'केवल स्थानीय — सिंक करने के लिए लॉगिन करें',
    signIn: 'लॉगिन / खाता बनाएं', signOut: 'लॉगआउट', viewPlans: 'प्लान और मूल्य देखें',
    upgradePlan: 'प्लान अपग्रेड करें', disconnectKey: 'API कुंजी डिस्कनेक्ट',
    model: 'मॉडल', defaultModel: 'डिफ़ॉल्ट मॉडल',
    appearance: 'दिखावट', theme: 'थीम', textSize: 'टेक्स्ट साइज़',
    dark: 'डार्क', light: 'लाइट', system: 'सिस्टम',
    data: 'डेटा', clearChat: 'चैट इतिहास साफ़ करें', clearTasks: 'स्थानीय कार्य साफ़ करें',
    clearJournal: 'स्थानीय डायरी साफ़ करें', areYouSure: 'क्या आप निश्चित हैं?', clear: 'साफ़ करें', cancel: 'रद्द करें',
    about: 'बारे में', version: 'संस्करण', website: 'वेबसाइट', termsOfService: 'सेवा की शर्तें', privacyPolicy: 'गोपनीयता नीति',
    localOnly: 'केवल स्थानीय — सिंक के लिए लॉगिन करें', synced: 'सिंक्ड', memory: 'स्मृति',
    addTask: 'कार्य जोड़ें', taskTitle: 'कार्य शीर्षक', noTasks: 'कोई कार्य नहीं', today: 'आज', all: 'सभी', overdue: 'अतिदेय', completed: 'पूर्ण',
    yourJournal: 'आपकी डायरी', avasJournal: 'Ava की डायरी', writeEntry: 'प्रविष्टि लिखें',
    noEntry: 'इस दिन कोई प्रविष्टि नहीं', avaNoEntry: 'Ava ने आज कुछ नहीं लिखा',
    avaWrites: 'Ava सत्र के अंत में अपने विचार लिखती है',
    saveEntry: 'सहेजें', mood: 'मूड', howAreYou: 'आज कैसा महसूस कर रहे हैं? स्वतंत्र रूप से लिखें...',
    welcome: 'Ava में आपका स्वागत है', welcomeSubtitle: 'आपका AI साथी, हर जगह', getStarted: 'शुरू करें', skip: 'छोड़ें',
    language: 'भाषा', delete: 'हटाएं', deleteConfirm: 'इसे हटाएं?', tapToEdit: 'संपादित करने के लिए टैप करें', nothingToday: 'आज कुछ नहीं', noActiveTasks: 'कोई सक्रिय कार्य नहीं', addTaskHint: 'कार्य जोड़ें या Ava से पूछें',
  },
  ru: {
    chat: 'Чат', tasks: 'Задачи', journal: 'Дневник', settings: 'Настройки',
    newChat: 'Новый чат', chatHistory: 'История',
    messagePlaceholder: 'Сообщение Аве...', noConversations: 'Нет бесед', startChatting: 'Начните общение с Авой',
    account: 'АККАУНТ', guest: 'Гость', guestSubtitle: 'Только локально — войдите для синхронизации',
    signIn: 'Войти / Создать аккаунт', signOut: 'Выйти', viewPlans: 'Тарифы и цены',
    upgradePlan: 'Улучшить план', disconnectKey: 'Отключить API-ключ',
    model: 'МОДЕЛЬ', defaultModel: 'Модель по умолчанию',
    appearance: 'ВНЕШНИЙ ВИД', theme: 'Тема', textSize: 'Размер текста',
    dark: 'Тёмная', light: 'Светлая', system: 'Системная',
    data: 'ДАННЫЕ', clearChat: 'Очистить историю', clearTasks: 'Очистить локальные задачи',
    clearJournal: 'Очистить локальный дневник', areYouSure: 'Вы уверены?', clear: 'Очистить', cancel: 'Отмена',
    about: 'О ПРИЛОЖЕНИИ', version: 'Версия', website: 'Сайт', termsOfService: 'Условия использования', privacyPolicy: 'Конфиденциальность',
    localOnly: 'Только локально — войдите для синхронизации', synced: 'Синхронизировано', memory: 'Память',
    addTask: 'Добавить задачу', taskTitle: 'Название задачи', noTasks: 'Нет задач', today: 'Сегодня', all: 'Все', overdue: 'Просроченные', completed: 'Завершённые',
    yourJournal: 'Ваш дневник', avasJournal: 'Дневник Авы', writeEntry: 'Написать запись',
    noEntry: 'Нет записи за этот день', avaNoEntry: 'Ава сегодня ничего не написала',
    avaWrites: 'Ава записывает мысли в конце сессий',
    saveEntry: 'Сохранить', mood: 'Настроение', howAreYou: 'Как вы себя чувствуете? Что произошло сегодня?',
    welcome: 'Добро пожаловать в Аву', welcomeSubtitle: 'Ваш ИИ-компаньон, везде', getStarted: 'Начать', skip: 'Пропустить',
    language: 'Язык', delete: 'Удалить', deleteConfirm: 'Удалить это?', tapToEdit: 'Нажмите для редактирования', nothingToday: 'Ничего на сегодня', noActiveTasks: 'Нет активных задач', addTaskHint: 'Добавьте задачу или спросите Аву',
  },
  tr: {
    chat: 'Sohbet', tasks: 'Görevler', journal: 'Günlük', settings: 'Ayarlar',
    newChat: 'Yeni sohbet', chatHistory: 'Geçmiş',
    messagePlaceholder: "Ava'ya mesaj...", noConversations: 'Konuşma yok', startChatting: "Ava ile sohbet başlat",
    account: 'HESAP', guest: 'Misafir', guestSubtitle: 'Yalnızca yerel — senkronize etmek için giriş yapın',
    signIn: 'Giriş / Hesap Oluştur', signOut: 'Çıkış', viewPlans: 'Plan ve fiyatları gör',
    upgradePlan: 'Planı yükselt', disconnectKey: 'API anahtarını kes',
    model: 'MODEL', defaultModel: 'Varsayılan model',
    appearance: 'GÖRÜNÜM', theme: 'Tema', textSize: 'Metin boyutu',
    dark: 'Koyu', light: 'Açık', system: 'Sistem',
    data: 'VERİ', clearChat: 'Sohbet geçmişini sil', clearTasks: 'Yerel görevleri sil',
    clearJournal: 'Yerel günlüğü sil', areYouSure: 'Emin misiniz?', clear: 'Sil', cancel: 'İptal',
    about: 'HAKKINDA', version: 'Sürüm', website: 'Web sitesi', termsOfService: 'Kullanım koşulları', privacyPolicy: 'Gizlilik politikası',
    localOnly: 'Yalnızca yerel — senkronize için giriş yapın', synced: 'Senkronize', memory: 'Hafıza',
    addTask: 'Görev ekle', taskTitle: 'Görev başlığı', noTasks: 'Görev yok', today: 'Bugün', all: 'Tümü', overdue: 'Gecikmiş', completed: 'Tamamlanan',
    yourJournal: 'Günlüğünüz', avasJournal: "Ava'nın günlüğü", writeEntry: 'Giriş yaz',
    noEntry: 'Bu gün için giriş yok', avaNoEntry: 'Ava bugün bir şey yazmadı',
    avaWrites: 'Ava oturum sonunda düşüncelerini yazar',
    saveEntry: 'Kaydet', mood: 'Ruh hali', howAreYou: 'Nasıl hissediyorsunuz? Bugün ne oldu?',
    welcome: "Ava'ya hoş geldiniz", welcomeSubtitle: 'Yapay zeka arkadaşınız, her yerde', getStarted: 'Başla', skip: 'Atla',
    language: 'Dil', delete: 'Sil', deleteConfirm: 'Bunu sil?', tapToEdit: 'Düzenlemek için dokunun', nothingToday: 'Bugün için bir şey yok', noActiveTasks: 'Aktif görev yok', addTaskHint: 'Görev ekleyin veya Ava\'ya sorun',
  },
};

// Remaining languages use English as fallback — they'll get Ava's AI-powered
// response in their language via the system prompt language detection
const SUPPORTED_LANGS = ['en', 'es', 'fr', 'de', 'ja', 'ko', 'zh-CN', 'pt', 'it', 'ar', 'hi', 'ru', 'tr'];

function detectBrowserLanguage(): string {
  if (typeof window === 'undefined') return 'en';

  const browserLang = navigator.language || 'en';

  // Exact match
  if (translations[browserLang]) return browserLang;

  // Base language match (e.g., 'es-MX' → 'es')
  const base = browserLang.split('-')[0];
  if (translations[base]) return base;

  // Special cases
  if (browserLang.startsWith('zh')) return 'zh-CN';

  return 'en';
}

function detectLanguage(): string {
  if (typeof window === 'undefined') return 'en';

  // Check saved preference
  const saved = localStorage.getItem('ava-companion-lang');
  if (saved === 'auto' || !saved) return detectBrowserLanguage();
  if (translations[saved]) return saved;

  return detectBrowserLanguage();
}

let currentLang = 'en';

export function initI18n() {
  currentLang = detectLanguage();
}

export function setLanguage(lang: string) {
  currentLang = lang === 'auto' ? detectBrowserLanguage() : lang;
  localStorage.setItem('ava-companion-lang', lang);
}

export function getLanguage(): string {
  return currentLang;
}

export function t(key: TranslationKey): string {
  return translations[currentLang]?.[key] || translations.en[key] || key;
}

export function getSupportedLanguages() {
  return [
    { code: 'auto', name: 'Auto (Browser)' },
    ...SUPPORTED_LANGS.map(code => ({
      code,
      name: {
        en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch',
        ja: '日本語', ko: '한국어', 'zh-CN': '中文', pt: 'Português',
        it: 'Italiano', ar: 'العربية', hi: 'हिन्दी', ru: 'Русский', tr: 'Türkçe',
      }[code] || code,
    })),
  ];
}
