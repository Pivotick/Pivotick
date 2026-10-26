/// <reference lib="es2022.intl" />

export const languages = ['en', 'zh', 'fr', 'de', 'pt', 'nl', 'ja', 'ar', 'es'] as const
export type SiteLanguage = typeof languages[number]

// Navigation and shared components are translated independently from page prose.
const words: Record<string, [string, string, string, string, string, string, string, string]> = {
    'Pivotick documentation': ['Pivotick 文档', 'Documentation de Pivotick', 'Pivotick-Dokumentation', 'Documentação do Pivotick', 'Pivotick-documentatie', 'Pivotick ドキュメント', 'توثيق Pivotick', 'Documentación de Pivotick'],
    'Home': ['首页', 'Accueil', 'Startseite', 'Início', 'Startpagina', 'ホーム', 'الرئيسية', 'Inicio'],
    'Getting Started': ['快速入门', 'Bien démarrer', 'Erste Schritte', 'Primeiros passos', 'Aan de slag', 'はじめに', 'البدء', 'Primeros pasos'],
    'Configuration': ['配置', 'Configuration', 'Konfiguration', 'Configuração', 'Configuratie', '設定', 'الإعدادات', 'Configuración'],
    'Gallery': ['示例库', 'Galerie', 'Galerie', 'Galeria', 'Galerij', 'ギャラリー', 'المعرض', 'Galería'],
    'Try it out!': ['在线体验', 'Essayer !', 'Ausprobieren!', 'Experimente!', 'Probeer het uit!', '試してみる！', 'جرّبه!', '¡Pruébalo!'],
    'Generated API docs': ['API 参考', 'Référence de l’API', 'API-Referenz', 'Referência da API', 'Gegenereerde API-documentatie', '生成された API ドキュメント', 'توثيق API المُولّد', 'Documentación generada de la API'],
    'Documentation': ['文档', 'Documentation', 'Dokumentation', 'Documentação', 'Documentatie', 'ドキュメント', 'التوثيق', 'Documentación'],
    'Projects': ['项目', 'Projets', 'Projekte', 'Projetos', 'Projecten', 'プロジェクト', 'المشاريع', 'Proyectos'],
    'Projects using Pivotick': ['使用 Pivotick 的项目', 'Projets utilisant Pivotick', 'Projekte mit Pivotick', 'Projetos que usam o Pivotick', 'Projecten met Pivotick', 'Pivotick を使ったプロジェクト', 'مشاريع تستخدم Pivotick', 'Proyectos que usan Pivotick'],
    'Callbacks': ['回调', 'Fonctions de rappel', 'Callbacks', 'Funções de retorno', 'Callbacks', 'コールバック', 'دوال الاستدعاء', 'Funciones de retorno'],
    'Edge layers': ['边图层', 'Couches d’arêtes', 'Kantenebenen', 'Camadas de arestas', 'Verbindingslagen', 'エッジレイヤー', 'طبقات الحواف', 'Capas de aristas'],
    'Simplify': ['简化', 'Simplifier', 'Vereinfachen', 'Simplificar', 'Vereenvoudigen', '簡略化', 'التبسيط', 'Simplificar'],
    'Layout': ['布局', 'Disposition', 'Layout', 'Layout', 'Indeling', 'レイアウト', 'التخطيط', 'Distribución'],
    'Render': ['渲染', 'Rendu', 'Darstellung', 'Renderização', 'Weergave', '描画', 'الرسم', 'Renderizado'],
    'Simulation': ['模拟', 'Simulation', 'Simulation', 'Simulação', 'Simulatie', 'シミュレーション', 'المحاكاة', 'Simulación'],
    'Customizing UI': ['自定义界面', 'Personnaliser l’interface', 'Oberfläche anpassen', 'Personalizar a interface', 'Interface aanpassen', 'UI のカスタマイズ', 'تخصيص الواجهة', 'Personalizar la interfaz'],
    'Sidebar': ['侧栏', 'Barre latérale', 'Seitenleiste', 'Barra lateral', 'Zijbalk', 'サイドバー', 'الشريط الجانبي', 'Barra lateral'],
    'Tooltip': ['提示框', 'Infobulle', 'Tooltip', 'Dica', 'Tooltip', 'ツールチップ', 'التلميح', 'Información emergente'],
    'Context Menu': ['上下文菜单', 'Menu contextuel', 'Kontextmenü', 'Menu de contexto', 'Contextmenu', 'コンテキストメニュー', 'القائمة السياقية', 'Menú contextual'],
    'Filters': ['筛选', 'Filtres', 'Filter', 'Filtros', 'Filters', 'フィルター', 'المرشحات', 'Filtros'],
    'Legend': ['图例', 'Légende', 'Legende', 'Legenda', 'Legenda', '凡例', 'وسيلة الإيضاح', 'Leyenda'],
    'Data table': ['数据表格', 'Tableau de données', 'Datentabelle', 'Tabela de dados', 'Gegevenstabel', 'データ表', 'جدول البيانات', 'Tabla de datos'],
    'Styling UI': ['界面样式', 'Style de l’interface', 'Oberflächengestaltung', 'Estilo da interface', 'Interface vormgeven', 'UI のスタイル', 'تنسيق الواجهة', 'Estilos de la interfaz'],
    'Translating the UI': ['翻译界面', 'Traduire l’interface', 'Oberfläche übersetzen', 'Traduzir a interface', 'Interface vertalen', 'UI の翻訳', 'ترجمة الواجهة', 'Traducir la interfaz'],
    'Plugins': ['插件', 'Extensions', 'Plugins', 'Plugins', 'Plug-ins', 'プラグイン', 'الإضافات', 'Complementos'],
    'Pivotick API': ['Pivotick API', 'API Pivotick', 'Pivotick-API', 'API Pivotick', 'Pivotick-API', 'Pivotick API', 'واجهة Pivotick البرمجية', 'API de Pivotick'],
    'Pivots & enrichment': ['拓展与数据增强', 'Pivots et enrichissement', 'Pivots und Anreicherung', 'Pivôs e enriquecimento', 'Pivots en verrijking', 'ピボットとデータ拡充', 'الاستكشاف والإثراء', 'Pivotes y enriquecimiento'],
    'Saving pivot results': ['保存拓展结果', 'Enregistrer les résultats des pivots', 'Pivot-Ergebnisse speichern', 'Salvar resultados dos pivôs', 'Pivotresultaten opslaan', 'ピボット結果の保存', 'حفظ نتائج الاستكشاف', 'Guardar resultados de pivotes'],
    'Undo & history': ['撤销与历史记录', 'Annulation et historique', 'Rückgängig und Verlauf', 'Desfazer e histórico', 'Ongedaan maken en geschiedenis', '元に戻す操作と履歴', 'التراجع والسجل', 'Deshacer e historial'],
    'Security': ['安全', 'Sécurité', 'Sicherheit', 'Segurança', 'Beveiliging', 'セキュリティ', 'الأمان', 'Seguridad'],
    'API docs': ['API 文档', 'Documentation de l’API', 'API-Dokumentation', 'Documentação da API', 'API-documentatie', 'API ドキュメント', 'توثيق API', 'Documentación de la API'],
    'Basics': ['基础', 'Bases', 'Grundlagen', 'Fundamentos', 'Basis', '基本', 'الأساسيات', 'Fundamentos'],
    'Node styling': ['节点样式', 'Style des nœuds', 'Knotengestaltung', 'Estilo dos nós', 'Knopen vormgeven', 'ノードのスタイル', 'تنسيق العقد', 'Estilos de nodos'],
    'Edge styling': ['边样式', 'Style des arêtes', 'Kantengestaltung', 'Estilo das arestas', 'Verbindingen vormgeven', 'エッジのスタイル', 'تنسيق الحواف', 'Estilos de aristas'],
    'Layouts': ['布局', 'Dispositions', 'Layouts', 'Layouts', 'Indelingen', 'レイアウト', 'التخطيطات', 'Distribuciones'],
    'Events & callbacks': ['事件与回调', 'Événements et rappels', 'Ereignisse und Callbacks', 'Eventos e funções de retorno', 'Gebeurtenissen en callbacks', 'イベントとコールバック', 'الأحداث ودوال الاستدعاء', 'Eventos y funciones de retorno'],
    'UI customization': ['界面自定义', 'Personnalisation de l’interface', 'Oberflächenanpassung', 'Personalização da interface', 'Interface aanpassen', 'UI のカスタマイズ', 'تخصيص الواجهة', 'Personalización de la interfaz'],
    'Editing & authoring': ['编辑与创建', 'Édition et création', 'Bearbeiten und Erstellen', 'Edição e criação', 'Bewerken en maken', '編集と作成', 'التحرير والتأليف', 'Edición y creación'],
    'Notes & annotations': ['备注与注释', 'Notes et annotations', 'Notizen und Anmerkungen', 'Notas e anotações', 'Notities en annotaties', 'メモと注釈', 'الملاحظات والتعليقات', 'Notas y anotaciones'],
    'Filtering, search & hierarchy': ['筛选、搜索与层级', 'Filtres, recherche et hiérarchie', 'Filter, Suche und Hierarchie', 'Filtros, pesquisa e hierarquia', 'Filteren, zoeken en hiërarchie', 'フィルター・検索・階層', 'التصفية والبحث والتسلسل الهرمي', 'Filtros, búsqueda y jerarquía'],
    'Programmatic control': ['编程控制', 'Contrôle par programmation', 'Programmatische Steuerung', 'Controle por programação', 'Programmatische besturing', 'プログラムによる制御', 'التحكم البرمجي', 'Control programático'],
    'Theming & performance': ['主题与性能', 'Thèmes et performances', 'Themes und Leistung', 'Temas e desempenho', 'Thema\'s en prestaties', 'テーマとパフォーマンス', 'السمات والأداء', 'Temas y rendimiento'],
    'Showpieces': ['综合示例', 'Démonstrations complètes', 'Anwendungsbeispiele', 'Demonstrações completas', 'Uitgelichte voorbeelden', '注目のサンプル', 'نماذج مميزة', 'Ejemplos destacados'],
    'On this page': ['本页内容', 'Sur cette page', 'Auf dieser Seite', 'Nesta página', 'Op deze pagina', 'このページの内容', 'في هذه الصفحة', 'En esta página'],
    'Previous page': ['上一页', 'Page précédente', 'Vorherige Seite', 'Página anterior', 'Vorige pagina', '前のページ', 'الصفحة السابقة', 'Página anterior'],
    'Next page': ['下一页', 'Page suivante', 'Nächste Seite', 'Próxima página', 'Volgende pagina', '次のページ', 'الصفحة التالية', 'Página siguiente'],
    'Last updated': ['最后更新', 'Dernière mise à jour', 'Zuletzt aktualisiert', 'Última atualização', 'Laatst bijgewerkt', '最終更新', 'آخر تحديث', 'Última actualización'],
    'Change language': ['切换语言', 'Changer de langue', 'Sprache ändern', 'Mudar idioma', 'Taal wijzigen', '言語を変更', 'تغيير اللغة', 'Cambiar idioma'],
    'Skip to content': ['跳转到内容', 'Aller au contenu', 'Zum Inhalt springen', 'Pular para o conteúdo', 'Naar inhoud', 'コンテンツへスキップ', 'انتقل إلى المحتوى', 'Ir al contenido'],
    'Appearance': ['外观', 'Apparence', 'Darstellung', 'Aparência', 'Weergave', '外観', 'المظهر', 'Apariencia'],
    'Switch to light theme': ['切换到浅色主题', 'Passer au thème clair', 'Zum hellen Theme wechseln', 'Mudar para o tema claro', 'Licht thema gebruiken', 'ライトテーマに切り替え', 'التبديل إلى السمة الفاتحة', 'Cambiar al tema claro'],
    'Switch to dark theme': ['切换到深色主题', 'Passer au thème sombre', 'Zum dunklen Theme wechseln', 'Mudar para o tema escuro', 'Donker thema gebruiken', 'ダークテーマに切り替え', 'التبديل إلى السمة الداكنة', 'Cambiar al tema oscuro'],
    'Menu': ['菜单', 'Menu', 'Menü', 'Menu', 'Menu', 'メニュー', 'القائمة', 'Menú'],
    'Return to top': ['返回顶部', 'Retour en haut', 'Nach oben', 'Voltar ao topo', 'Terug naar boven', '先頭に戻る', 'العودة إلى الأعلى', 'Volver arriba'],
    'Search': ['搜索', 'Rechercher', 'Suchen', 'Pesquisar', 'Zoeken', '検索', 'بحث', 'Buscar'],
    'Search documentation': ['搜索文档', 'Rechercher dans la documentation', 'Dokumentation durchsuchen', 'Pesquisar documentação', 'Documentatie doorzoeken', 'ドキュメントを検索', 'البحث في التوثيق', 'Buscar en la documentación'],
    'Display detailed list': ['显示详细列表', 'Afficher la liste détaillée', 'Detaillierte Liste anzeigen', 'Exibir lista detalhada', 'Uitgebreide lijst tonen', '詳細一覧を表示', 'عرض قائمة مفصلة', 'Mostrar lista detallada'],
    'Reset search': ['重置搜索', 'Réinitialiser la recherche', 'Suche zurücksetzen', 'Redefinir pesquisa', 'Zoekopdracht wissen', '検索をリセット', 'إعادة ضبط البحث', 'Restablecer búsqueda'],
    'Back': ['返回', 'Retour', 'Zurück', 'Voltar', 'Terug', '戻る', 'رجوع', 'Volver'],
    'No results for': ['未找到结果：', 'Aucun résultat pour', 'Keine Ergebnisse für', 'Nenhum resultado para', 'Geen resultaten voor', '結果がありません:', 'لا توجد نتائج لـ', 'Sin resultados para'],
    'to select': ['选择', 'pour sélectionner', 'zum Auswählen', 'para selecionar', 'om te selecteren', 'で選択', 'للتحديد', 'para seleccionar'],
    'to navigate': ['导航', 'pour naviguer', 'zum Navigieren', 'para navegar', 'om te navigeren', 'で移動', 'للتنقل', 'para navegar'],
    'to close': ['关闭', 'pour fermer', 'zum Schließen', 'para fechar', 'om te sluiten', 'で閉じる', 'للإغلاق', 'para cerrar'],
    'Enter': ['回车', 'Entrée', 'Eingabe', 'Enter', 'Enter', 'Enter', 'إدخال', 'Intro'],
    'Up arrow': ['向上箭头', 'Flèche vers le haut', 'Pfeil nach oben', 'Seta para cima', 'Pijl omhoog', '上矢印', 'سهم للأعلى', 'Flecha arriba'],
    'Down arrow': ['向下箭头', 'Flèche vers le bas', 'Pfeil nach unten', 'Seta para baixo', 'Pijl omlaag', '下矢印', 'سهم للأسفل', 'Flecha abajo'],
    'Escape': ['Esc', 'Échap', 'Esc', 'Esc', 'Esc', 'Esc', 'إلغاء', 'Esc'],
    'Page not found': ['页面未找到', 'Page introuvable', 'Seite nicht gefunden', 'Página não encontrada', 'Pagina niet gevonden', 'ページが見つかりません', 'الصفحة غير موجودة', 'Página no encontrada'],
    'This page does not exist.': ['此页面不存在。', 'Cette page n’existe pas.', 'Diese Seite existiert nicht.', 'Esta página não existe.', 'Deze pagina bestaat niet.', 'このページは存在しません。', 'هذه الصفحة غير موجودة.', 'Esta página no existe.'],
    'Take me home': ['返回首页', 'Retour à l’accueil', 'Zur Startseite', 'Voltar ao início', 'Naar de startpagina', 'ホームに戻る', 'العودة إلى الرئيسية', 'Volver al inicio'],
    'No preview yet': ['暂无预览', 'Aucun aperçu', 'Noch keine Vorschau', 'Ainda sem prévia', 'Nog geen voorbeeld', 'プレビューはまだありません', 'لا توجد معاينة بعد', 'Aún sin vista previa'],
    'Coming soon.': ['即将推出。', 'Bientôt disponible.', 'Bald verfügbar.', 'Em breve.', 'Binnenkort beschikbaar.', '近日公開。', 'قريبًا.', 'Próximamente.'],
    'Permalink to': ['永久链接：', 'Lien permanent vers', 'Direktlink zu', 'Link permanente para', 'Permanente link naar', '固定リンク:', 'رابط دائم إلى', 'Enlace permanente a'],
    'Interact with the graph…': ['与图交互…', 'Interagissez avec le graphe…', 'Mit dem Graphen interagieren…', 'Interaja com o grafo…', 'Gebruik de grafiek…', 'グラフを操作…', 'تفاعل مع الرسم البياني…', 'Interactúa con el grafo…'],
}

export function siteLanguage(locale: string): SiteLanguage {
    const language = locale.split('-')[0] as SiteLanguage
    return languages.includes(language) ? language : 'en'
}

export function siteText(text: string, locale = 'en'): string {
    const index = languages.indexOf(siteLanguage(locale)) - 1
    return index < 0 ? text : words[text]?.[index] ?? text
}

// Use the same word boundaries when indexing and querying, including Chinese
// prose without spaces. Keep this function self-contained for VitePress serialization.
export function searchTerms(text: string): string[] {
    return [...new Intl.Segmenter('en', { granularity: 'word' }).segment(text)]
        .filter(word => word.isWordLike)
        .flatMap(word => word.segment.match(/[\p{L}\p{N}_]+/gu) ?? [])
}

export function localizedLink(href: string, locale: string): string {
    const language = siteLanguage(locale)
    // These internal classes have no exported API page; their public options
    // and extension points are documented in the corresponding guides.
    if (href === '/api/html/classes/UIManager.html') href = '/ui-sidebar#registering-panels-at-runtime'
    if (href === '/api/html/interfaces/GraphQueryEngine.FilterFacet.html') href = '/ui-filter#declared-facets'
    if (href.startsWith('/api/html/')) {
        const legacy = /^\/api\/html\/([^/]+)\/([^/#]+)\.html(.*)$/.exec(href)
        if (legacy) {
            const [, legacyKind, name, suffix] = legacy
            const kind = legacyKind === 'types' ? 'type-aliases' : legacyKind
            const parts = name.split('.')
            href = parts.length > 1
                ? `/reference/pivotick/namespaces/${parts.slice(0, -1).join('/')}/${kind}/${parts[parts.length - 1]}${suffix}`
                : `/reference/${kind}/${name}${suffix}`
        }
    }
    if (!href.startsWith('/') || href.startsWith('//') || /\.(?!md(?:[?#]|$)|html(?:[?#]|$))[\w]+(?:[?#]|$)/.test(href)) return href
    if (/^\/(?:zh|fr|de|pt|nl|ja|ar|es)(?:\/|$)/.test(href)) return href
    return language === 'en' ? href : `/${language}${href}`
}
