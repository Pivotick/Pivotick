/// <reference lib="es2022.intl" />

export const languages = ['en', 'zh', 'fr', 'de', 'pt'] as const
export type SiteLanguage = typeof languages[number]

// Navigation and shared components are translated independently from page prose.
const words: Record<string, [string, string, string, string]> = {
    'Pivotick documentation': ['Pivotick 文档', 'Documentation de Pivotick', 'Pivotick-Dokumentation', 'Documentação do Pivotick'],
    'Home': ['首页', 'Accueil', 'Startseite', 'Início'],
    'Getting Started': ['快速入门', 'Bien démarrer', 'Erste Schritte', 'Primeiros passos'],
    'Configuration': ['配置', 'Configuration', 'Konfiguration', 'Configuração'],
    'Gallery': ['示例库', 'Galerie', 'Galerie', 'Galeria'],
    'Try it out!': ['在线体验', 'Essayer !', 'Ausprobieren!', 'Experimente!'],
    'Generated API docs': ['API 参考', 'Référence de l’API', 'API-Referenz', 'Referência da API'],
    'Callbacks': ['回调', 'Fonctions de rappel', 'Callbacks', 'Funções de retorno'],
    'Edge layers': ['边图层', 'Couches d’arêtes', 'Kantenebenen', 'Camadas de arestas'],
    'Simplify': ['简化', 'Simplifier', 'Vereinfachen', 'Simplificar'],
    'Layout': ['布局', 'Disposition', 'Layout', 'Layout'],
    'Render': ['渲染', 'Rendu', 'Darstellung', 'Renderização'],
    'Simulation': ['模拟', 'Simulation', 'Simulation', 'Simulação'],
    'Customizing UI': ['自定义界面', 'Personnaliser l’interface', 'Oberfläche anpassen', 'Personalizar a interface'],
    'Sidebar': ['侧栏', 'Barre latérale', 'Seitenleiste', 'Barra lateral'],
    'Tooltip': ['提示框', 'Infobulle', 'Tooltip', 'Dica'],
    'Context Menu': ['上下文菜单', 'Menu contextuel', 'Kontextmenü', 'Menu de contexto'],
    'Filters': ['筛选', 'Filtres', 'Filter', 'Filtros'],
    'Legend': ['图例', 'Légende', 'Legende', 'Legenda'],
    'Data table': ['数据表格', 'Tableau de données', 'Datentabelle', 'Tabela de dados'],
    'Styling UI': ['界面样式', 'Style de l’interface', 'Oberflächengestaltung', 'Estilo da interface'],
    'Translating the UI': ['翻译界面', 'Traduire l’interface', 'Oberfläche übersetzen', 'Traduzir a interface'],
    'Plugins': ['插件', 'Extensions', 'Plugins', 'Plugins'],
    'Pivotick API': ['Pivotick API', 'API Pivotick', 'Pivotick-API', 'API Pivotick'],
    'Pivots & enrichment': ['拓展与数据增强', 'Pivots et enrichissement', 'Pivots und Anreicherung', 'Pivôs e enriquecimento'],
    'Saving pivot results': ['保存拓展结果', 'Enregistrer les résultats des pivots', 'Pivot-Ergebnisse speichern', 'Salvar resultados dos pivôs'],
    'Undo & history': ['撤销与历史记录', 'Annulation et historique', 'Rückgängig und Verlauf', 'Desfazer e histórico'],
    'Security': ['安全', 'Sécurité', 'Sicherheit', 'Segurança'],
    'API docs': ['API 文档', 'Documentation de l’API', 'API-Dokumentation', 'Documentação da API'],
    'Basics': ['基础', 'Bases', 'Grundlagen', 'Fundamentos'],
    'Node styling': ['节点样式', 'Style des nœuds', 'Knotengestaltung', 'Estilo dos nós'],
    'Edge styling': ['边样式', 'Style des arêtes', 'Kantengestaltung', 'Estilo das arestas'],
    'Layouts': ['布局', 'Dispositions', 'Layouts', 'Layouts'],
    'Events & callbacks': ['事件与回调', 'Événements et rappels', 'Ereignisse und Callbacks', 'Eventos e funções de retorno'],
    'UI customization': ['界面自定义', 'Personnalisation de l’interface', 'Oberflächenanpassung', 'Personalização da interface'],
    'Editing & authoring': ['编辑与创建', 'Édition et création', 'Bearbeiten und Erstellen', 'Edição e criação'],
    'Notes & annotations': ['备注与注释', 'Notes et annotations', 'Notizen und Anmerkungen', 'Notas e anotações'],
    'Filtering, search & hierarchy': ['筛选、搜索与层级', 'Filtres, recherche et hiérarchie', 'Filter, Suche und Hierarchie', 'Filtros, pesquisa e hierarquia'],
    'Programmatic control': ['编程控制', 'Contrôle par programmation', 'Programmatische Steuerung', 'Controle por programação'],
    'Theming & performance': ['主题与性能', 'Thèmes et performances', 'Themes und Leistung', 'Temas e desempenho'],
    'Showpieces': ['综合示例', 'Démonstrations complètes', 'Anwendungsbeispiele', 'Demonstrações completas'],
    'On this page': ['本页内容', 'Sur cette page', 'Auf dieser Seite', 'Nesta página'],
    'Previous page': ['上一页', 'Page précédente', 'Vorherige Seite', 'Página anterior'],
    'Next page': ['下一页', 'Page suivante', 'Nächste Seite', 'Próxima página'],
    'Last updated': ['最后更新', 'Dernière mise à jour', 'Zuletzt aktualisiert', 'Última atualização'],
    'Change language': ['切换语言', 'Changer de langue', 'Sprache ändern', 'Mudar idioma'],
    'Skip to content': ['跳转到内容', 'Aller au contenu', 'Zum Inhalt springen', 'Pular para o conteúdo'],
    'Appearance': ['外观', 'Apparence', 'Darstellung', 'Aparência'],
    'Switch to light theme': ['切换到浅色主题', 'Passer au thème clair', 'Zum hellen Theme wechseln', 'Mudar para o tema claro'],
    'Switch to dark theme': ['切换到深色主题', 'Passer au thème sombre', 'Zum dunklen Theme wechseln', 'Mudar para o tema escuro'],
    'Menu': ['菜单', 'Menu', 'Menü', 'Menu'],
    'Return to top': ['返回顶部', 'Retour en haut', 'Nach oben', 'Voltar ao topo'],
    'Search': ['搜索', 'Rechercher', 'Suchen', 'Pesquisar'],
    'Search documentation': ['搜索文档', 'Rechercher dans la documentation', 'Dokumentation durchsuchen', 'Pesquisar documentação'],
    'Display detailed list': ['显示详细列表', 'Afficher la liste détaillée', 'Detaillierte Liste anzeigen', 'Exibir lista detalhada'],
    'Reset search': ['重置搜索', 'Réinitialiser la recherche', 'Suche zurücksetzen', 'Redefinir pesquisa'],
    'Back': ['返回', 'Retour', 'Zurück', 'Voltar'],
    'No results for': ['未找到结果：', 'Aucun résultat pour', 'Keine Ergebnisse für', 'Nenhum resultado para'],
    'to select': ['选择', 'pour sélectionner', 'zum Auswählen', 'para selecionar'],
    'to navigate': ['导航', 'pour naviguer', 'zum Navigieren', 'para navegar'],
    'to close': ['关闭', 'pour fermer', 'zum Schließen', 'para fechar'],
    'Enter': ['回车', 'Entrée', 'Eingabe', 'Enter'],
    'Up arrow': ['向上箭头', 'Flèche vers le haut', 'Pfeil nach oben', 'Seta para cima'],
    'Down arrow': ['向下箭头', 'Flèche vers le bas', 'Pfeil nach unten', 'Seta para baixo'],
    'Escape': ['Esc', 'Échap', 'Esc', 'Esc'],
    'Page not found': ['页面未找到', 'Page introuvable', 'Seite nicht gefunden', 'Página não encontrada'],
    'This page does not exist.': ['此页面不存在。', 'Cette page n’existe pas.', 'Diese Seite existiert nicht.', 'Esta página não existe.'],
    'Take me home': ['返回首页', 'Retour à l’accueil', 'Zur Startseite', 'Voltar ao início'],
    'No preview yet': ['暂无预览', 'Aucun aperçu', 'Noch keine Vorschau', 'Ainda sem prévia'],
    'Coming soon.': ['即将推出。', 'Bientôt disponible.', 'Bald verfügbar.', 'Em breve.'],
    'Permalink to': ['永久链接：', 'Lien permanent vers', 'Direktlink zu', 'Link permanente para'],
    'Interact with the graph…': ['与图交互…', 'Interagissez avec le graphe…', 'Mit dem Graphen interagieren…', 'Interaja com o grafo…'],
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
    if (/^\/(?:zh|fr|de|pt)(?:\/|$)/.test(href)) return href
    return language === 'en' ? href : `/${language}${href}`
}
