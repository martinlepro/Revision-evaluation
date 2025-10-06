// script.js (Version complète mise à jour pour fonctionner avec le serveur proxy OpenAI)

// --- FONCTIONS DE DÉBOGAGE PERSONNALISÉES ---
// (Les fonctions de logging restent inchangées et sont critiques pour le débogage)
const debugElement = document.getElementById('debug');
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

function appendToDebug(message, type = 'log') {
    if (debugElement) {
        const p = document.createElement('p');
        p.style.whiteSpace = 'pre-wrap';
        p.textContent = `[${type.toUpperCase()}] ${new Date().toLocaleTimeString()} : ${message}`;
        if (type === 'error') {
            p.style.color = '#ff6b6b';
        } else if (type === 'warn') {
            p.style.color = '#ffe082';
        } else if (type === 'info') {
            p.style.color = '#aed7ff';
        } else {
            p.style.color = 'yellow';
        }
        if (debugElement.firstChild) {
            debugElement.insertBefore(p, debugElement.firstChild);
        } else {
            debugElement.appendChild(p);
        }
        while (debugElement.childElementCount > 50) {
            debugElement.removeChild(debugElement.lastChild);
        }
    }
}

console.log = function(...args) {
    originalConsoleLog.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'log');
};
console.warn = function(...args) {
    originalConsoleWarn.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'warn');
};
console.error = function(...args) {
    originalConsoleError.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'error');
};
console.log("script.js chargé. Logging personnalisé actif.");

// --- Variables Globales ---
const MATIERES_BASE_PATH = 'matieres';
let selectedItems = []; 
let currentQuizData = []; 
let currentQuestionIndex = 0;
let totalQuizPoints = 0; 
let userScore = 0; 
let isQuizRunning = false;

// REMPLACER PAR L'URL DE VOTRE SERVEUR RENDER
const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`;
const GENERATION_API_URL = `${BASE_API_URL}/generation`;
const TTS_API_URL = `${BASE_API_URL}/tts`; // La route TTS est conservée

console.log(`URL de l'API Backend: ${BASE_API_URL}`);

// --- Structure des matières (Catalogue des leçons) ---
// --- Gestion de la structure des matières (Catalogue des leçons) ---
// Note : Le 'type' ici est un 'type de leçon', et non le type de question générée.

const STRUCTURE = {
    "Mathematiques": {
        "Nombres_Premiers": [
            { name: "Leçon Nombres Premiers", file: "lecon_nombres_premiers.txt", type: "qcm" } // Leçon support
        ],
        "T1_STATISTIQUES": [
            { name: "Statistiques", file: "Mathematiques/T1_STATISTIQUES/Statistiques.txt", type: "qcm" } 
        ],
        "G1_Triangles et proportionnalité": [
            { name: "Théorème de Thalès", file: "Mathematiques/G1-Triangles et proportionnalité/Triangles et proportionnalité.txt", type: "qcm" } 
        ],
        "GEOMETRIE_LES_AIRES": [
            { name: "Formules d'Aires et Périmètres", file: "Mathematiques/Les aires.txt", type: "qcm" } 
        ]
    },
    "Francais": {
        "Grammaire": [
            { name: "Les classes grammaticales", file: "Francais/Grammaire/Les classes grammaticales.txt", type: "qcm" },
            { name: "L'accord du verbe et du sujet", file: "Francais/Grammaire/L'accord du verbe et du sujet .txt", type: "qcm" }
        ],
        "Analyse": [
            { name: "Analyse d'un texte", file: "Francais/Analyse/Analyse d'un texte .txt", type: "paragraphe" },
            { name: "Autoportrait", file: "Francais/Analyse/Autoportrait.txt", type: "paragraphe" } 
        ]
    },
    "Histoire-Geo": {
        "Histoire": [
            { name: "1er Guerre Mondiale", file: "Histoire_Geo/Histoire/1er-Guerre-Mondiale.txt", type: "paragraphe" }
        ],
        "Geographie": [
            { name: "Les aires urbaines", file: "Histoire_Geo/Geographie/Les aires urbaines.txt", type: "paragraphe" } 
        ]
    },
    "Physique-Chimie": {
        "Chimie": [
            { name: "Atomes et Tableau Périodique", file: "Physique-Chimie/Chimie/Atomes et Tableau Périodique.txt", type: "qcm" }
        ]
    },
    "Science-de-la-Vie-et-de-la-Terre": {
        "Biologie": [
            { name: "Le programme génétique", file: "Science-de-la-Vie-et-de-la-Terre/Biologie/Le programme génétique.txt", type: "qcm" },
            { name: "L'Hérédité (Génétique)", file: "Science-de-la-Vie-et-de-la-Terre/Biologie/L'Hérédité (Génétique).txt", type: "qcm" }
        ]
    },
    "Technologie": {
        "Systèmes": [
            { name: "Les systèmes automatisés", file: "Technologie/Systèmes/Les systèmes automatisés.txt", type: "qcm" }
        ]
    },
    "Anglais": {
        "Culture": [
            { name: "Les pays anglophones", file: "Anglais/Culture/Les pays anglophones.txt", type: "qcm" }
        ]
    },
    "Musique": {
        "Histoire": [
            { name: "La Chanson Engagée", file: "musique/Histoire/Chanson engagée.txt", type: "paragraphe" }
        ]
    },
    "Arts-Plastiques": {
        "ANALYSE_OEUVRE": [
            { name: "Méthode pour analyser une œuvre d'art", file: "Art-Plastiques/Méthode pour analyser une œuvre d'art.txt", type: "paragraphe" }
        ]
    }
};

// --- FONCTIONS DE DÉMARRAGE ET DE CHARGEMENT ---

document.addEventListener('DOMContentLoaded', () => {
    renderMenu();

    // Associer les boutons de type de quiz aux fonctions
    document.getElementById('start-quiz-btn').addEventListener('click', () => startQuiz('mixte'));
    document.getElementById('start-qcm-btn').addEventListener('click', () => startQuiz('qcm'));
    document.getElementById('start-paragraphe-btn').addEventListener('click', () => startQuiz('paragraphe_ia'));
    document.getElementById('start-dictation-btn').addEventListener('click', () => startQuiz('dictation'));
    document.getElementById('start-spot-error-btn').addEventListener('click', () => startQuiz('spot_error')); // Nouveau bouton

    document.getElementById('next-question-btn').addEventListener('click', nextQuestion);
    updateSelectedBox();
});

function renderMenu() {
    const menuContainer = document.getElementById('menu-container');
    let html = '';
    for (const matiere in STRUCTURE) {
        html += `<div class="matiere"><h2>${matiere}</h2>`;
        for (const subMatiere in STRUCTURE[matiere]) {
            html += `<div class="sub-matiere"><h3>${subMatiere}</h3><ul>`;
            STRUCTURE[matiere][subMatiere].forEach(item => {
                const path = getItemPath(matiere, subMatiere, item);
                const isSelected = selectedItems.some(sel => sel.path === path);
                html += `
                    <li>
                        <label>
                            <input type="checkbox" data-path="${path}" data-name="${item.name}" onchange="toggleSelection(this)" ${isSelected ? 'checked' : ''}>
                            ${item.name}
                        </label>
                    </li>
                `;
            });
            html += `</ul></div>`;
        }
        html += `</div>`;
    }
    menuContainer.innerHTML = html;
}

function getItemPath(matiere, subMatiere, item) {
    return `${matiere}/${subMatiere}/${item.file}`;
}

function toggleSelection(checkbox) {
    const path = checkbox.getAttribute('data-path');
    const name = checkbox.getAttribute('data-name');
    
    if (checkbox.checked) {
        if (!selectedItems.some(item => item.path === path)) {
            selectedItems.push({ path, name });
        }
    } else {
        selectedItems = selectedItems.filter(item => item.path !== path);
    }
    console.log("Sélection mise à jour. Total:", selectedItems.length);
    updateSelectedBox();
}

function updateSelectedBox() {
    const selectedItemsSpan = document.getElementById('selected-items');
    if (selectedItems.length === 0) {
        selectedItemsSpan.textContent = 'Aucun sujet sélectionné.';
    } else {
        selectedItemsSpan.innerHTML = selectedItems.map(item => `**${item.name}**`).join(', ');
    }
}

async function fetchContent(path) {
    // Simule la récupération du contenu. Dans un vrai déploiement,
    // l'API doit être configurée pour lire ces fichiers.
    const mockContent = `Leçon sur ${path}`; 
    return mockContent;
}

function parseMarkdown(text) {
    if (typeof text !== 'string') return text;
    // Remplace **texte** par <span class="bold-underline">texte</span>
    return text.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight: bold; text-decoration: underline;">$1</span>');
}


// --- LOGIQUE DE GÉNÉRATION ET DÉMARRAGE ---

async function startQuiz(quizType = 'mixte') {
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins un sujet de révision.");
        return;
    }
    // ------------------------------------------------------------------
    // AJOUTER LE MESSAGE DE CHARGEMENT IMMÉDIATEMENT APRÈS LA VÉRIFICATION !
    // ------------------------------------------------------------------
    document.getElementById('quiz-view').style.display = 'block';
    document.getElementById('selection-view').style.display = 'none';

    document.getElementById('question-container').innerHTML = `
        <h2 style="color: #007bff;">⏳ Génération du Quiz en cours...</h2>
        <p class="loading-message">Le serveur d'entraînement (Render) est en train de se réveiller et de générer les questions. Veuillez patienter (jusqu'à 60 secondes la première fois).</p>
    `;
    // ------------------------------------------------------------------
    if (isQuizRunning) return;
    isQuizRunning = true;

    // Réinitialisation du quiz
    currentQuizData = [];
    currentQuestionIndex = 0;
    userScore = 0;
    totalQuizPoints = 0;
    
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';
    const feedbackDiv = document.getElementById('ai-generation-feedback');
    feedbackDiv.innerHTML = '<p class="info">Génération du quiz en cours, veuillez patienter...</p>';

    for (const item of selectedItems) {
        if (quizType === 'dictation') {
            await generateDictationQuestion(item.path);
            break; 
        }

        const content = await fetchContent(item.path); 
        if (content) {
            console.log(`Contenu de ${item.name} chargé. Génération de question de type ${quizType}...`);
            await generateRandomQuestionFromContent(content, quizType, item.name);
        }
    }
    
    isQuizRunning = false; 
    feedbackDiv.innerHTML = ''; 

    if (currentQuizData.length > 0) {
        displayCurrentQuestion();
    } else if (quizType !== 'dictation') {
        alert("Aucune question n'a pu être générée. Vérifiez le serveur et le format JSON.");
        document.getElementById('quiz-view').style.display = 'none';
        document.getElementById('selection-view').style.display = 'block';
    }
}

async function generateRandomQuestionFromContent(content, forcedType, sourceName) {
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = `<p class="info">⏳ Contact de l'IA pour générer une question pour **${sourceName}**...</p>`;
    
    let questionTypesToGenerate = ['qcm', 'paragraphe_ia', 'vrai_faux', 'spot_error']; 
    let contentType = forcedType === 'mixte' 
        ? questionTypesToGenerate[Math.floor(Math.random() * questionTypesToGenerate.length)]
        : forcedType;

    let systemPrompt = `À partir du contenu de la leçon suivant, générez une seule question au format JSON. Votre rôle est d'être un générateur de questions pour un élève de 3e. Ne donnez aucun texte supplémentaire, seulement le JSON.`;
    let userPrompt = `Contenu de la leçon:\n---\n${content}\n---\n`;
    
    // Contraintes pour le type de question
    if (contentType === 'qcm') {
        systemPrompt += ` Le format JSON doit être: {"type": "qcm", "question": "...", "options": ["...", "...", "...", "..."], "correct_answer": "...", "points": 1}`;
        userPrompt += `Générez une question à choix multiples (QCM) de niveau 3e avec 4 options.`;
    } else if (contentType === 'paragraphe_ia') {
        systemPrompt += ` Le format JSON doit être: {"type": "paragraphe_ia", "sujet": "...", "attendus": ["..."], "consigne_ia": "..."}`;
        userPrompt += `Générez un sujet de paragraphe argumenté ou de développement construit. La clé "consigne_ia" est une instruction détaillée pour le correcteur IA.`;
    } else if (contentType === 'vrai_faux') {
        systemPrompt += ` Le format JSON doit être: {"type": "vrai_faux", "question": "...", "correct_answer": "Vrai" ou "Faux", "points": 1}`;
        userPrompt += `Générez une question Vrai/Faux. La réponse doit être strictement "Vrai" ou "Faux" (avec une majuscule).`;
    } else if (contentType === 'spot_error') { // NOUVEAU TYPE
        systemPrompt += ` Le format JSON doit être: {"type": "spot_error", "question": "...", "texte_avec_erreur": "...", "correct_answer": "...", "points": 3}`;
        userPrompt += `Générez une question de type 'Trouver l'erreur' sur la leçon. La clé "texte_avec_erreur" doit contenir une phrase ou un énoncé qui semble correct mais contient UNE SEULE erreur factuelle ou de définition. La clé "correct_answer" doit contenir la correction complète et détaillée.`;
    } else {
        console.error("Type de question invalide pour la génération aléatoire:", contentType);
        generationFeedbackDiv.innerHTML = '<p class="error">❌ Type de question IA invalide.</p>';
        return;
    }

    try {
        const response = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // On envoie un format simple d'objets pour le proxy. Le serveur se chargera de la structure OpenAI.
            body: JSON.stringify({ systemPrompt, userPrompt, model: "gpt-4o-mini" }) 
        });

        const aiData = await response.json();
        
        if (aiData.error) { throw new Error(aiData.error.details || aiData.error); }
        
        if (aiData.generated_content) {
            // Nettoyage de la réponse pour extraire le JSON (nécessaire avec la plupart des modèles)
            const jsonString = aiData.generated_content.replace(/```json|```/g, '').trim();
            const generatedQuestion = JSON.parse(jsonString);
            
            if (generatedQuestion.type === contentType) {
                generatedQuestion.sourceName = sourceName;
                currentQuizData.push(generatedQuestion);
                
                if (generatedQuestion.points) {
                    totalQuizPoints += generatedQuestion.points;
                }
                
                generationFeedbackDiv.innerHTML = `<p class="correct">✅ Question de type **${contentType}** pour **${sourceName}** générée.</p>`;
            } else {
                 generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA a généré un type de contenu inattendu.</p>';
                 console.error("Type de contenu généré par l'IA ne correspond pas au type demandé. Attendu:", contentType, "Reçu:", generatedQuestion.type);
            }
        } else {
            console.error("Réponse de l'API de génération incomplète ou mal formée:", aiData);
            generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA n\'a pas pu générer le contenu. Réponse inattendue du serveur.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la génération par l'IA:", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur de connexion ou format JSON invalide. Détails: ${error.message}</p>`;
    }
}

async function generateDictationQuestion(path) {
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = '<p class="info">⏳ Préparation de la dictée...</p>';
    
    const content = await fetchContent(path);
    
    // 1. Demander à l'IA de synthétiser le texte en une courte dictée
    const systemPrompt = `À partir de la leçon, générez un court texte (maximum 40 mots) sous forme de dictée pour un élève de 3e. Ne donnez que le texte de la dictée, sans ponctuation finale.`;
    const userPrompt = `Contenu de la leçon:\n---\n${content}\n---\nTexte de la dictée :`;
    
    try {
        const response = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt, userPrompt, model: "gpt-4o-mini" }) 
        });

        const aiData = await response.json();
        const dictationText = aiData.generated_content ? aiData.generated_content.trim().replace(/['"«»]/g, '') : null;
        
        if (!dictationText || aiData.error) {
             throw new Error(aiData.error ? aiData.error.details : "Texte de dictée vide.");
        }

        // 2. Afficher la question de dictée
        currentQuizData.push({ type: 'dictation', text: dictationText, sourceName: path });
        displayCurrentQuestion();

        // 3. Demander à l'IA de générer l'audio (TTS)
        await generateAndPlayTTS(dictationText);

    } catch (error) {
        console.error("Erreur lors de la préparation de la dictée:", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur lors de la préparation de la dictée. Détails: ${error.message}</p>`;
    }
}

// NOTE: Cette fonction utilise la route /tts de votre serveur proxy
async function generateAndPlayTTS(text) {
    const correctionDiv = document.getElementById('correction-feedback');
    correctionDiv.innerHTML = '<p class="info">🎶 Génération et lecture audio en cours...</p>';
    
    // Mettre à jour l'URL d'appel pour la fonction
    const ttsUrl = `${TTS_API_URL}`; 

    try {
        const response = await fetch(ttsUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        
        if (response.ok) {
            // Créer un blob pour l'audio et le lire
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.play().then(() => {
                // Le bouton permet de rejouer l'audio
                correctionDiv.innerHTML = `<p class="correct">🔊 Écoutez la dictée et écrivez le texte ci-dessous.</p><button onclick="generateAndPlayTTS('${text.replace(/'/g, "\\'")}')">Rejouer l'audio</button>`;
            }).catch(e => {
                correctionDiv.innerHTML = `<p class="warn">🔊 **Lecture audio bloquée.** Veuillez cliquer ici : <button onclick="generateAndPlayTTS('${text.replace(/'/g, "\\'")}')">Lancer l'audio</button></p>`;
                console.warn("Lecture audio bloquée, nécessite interaction utilisateur.", e);
            });
        } else {
            correctionDiv.innerHTML = `<p class="error">❌ Le serveur n'a pas pu générer l'audio (TTS : ${response.statusText}).</p>`;
            console.error("Erreur TTS:", response.status, response.statusText);
        }

    } catch (error) {
        console.error("Erreur lors de l'appel TTS:", error);
        correctionDiv.innerHTML = `<p class="error">❌ Erreur de connexion pour la synthèse vocale. Détails: ${error.message}</p>`;
    }
}


// --- FONCTIONS D'AFFICHAGE DU QUIZ (Spot Error inclus) ---
// (Même logique d'affichage que précédemment, Spot Error est géré)

function displayCurrentQuestion() {
    if (currentQuestionIndex >= currentQuizData.length) {
        showFinalScore();
        return;
    }
    
    // Nettoyage de l'interface
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    if (correctionFeedbackDiv) correctionFeedbackDiv.innerHTML = '';
    
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) nextQuestionBtn.style.display = 'none';

    const currentQuestion = currentQuizData[currentQuestionIndex];
    const questionContainer = document.getElementById('question-container');
    let html = '';

    const questionText = parseMarkdown(currentQuestion.question || currentQuestion.sujet || currentQuestion.text || '');
    
    html += `<h3 style="margin-bottom: 20px; text-align: right;">Question ${currentQuestionIndex + 1} sur ${currentQuizData.length} (Source : ${currentQuestion.sourceName})</h3>`;

    switch (currentQuestion.type) {
        case 'qcm':
            html += `
                <div class="qcm-question">
                    <h3>Question à Choix Multiples (Points: ${currentQuestion.points})</h3>
                    <p class="question-text">${questionText}</p>
                    <div class="options">
                        ${currentQuestion.options.map((option) => `
                            <label>
                                <input type="radio" name="qcm_answer" value="${option}"> ${parseMarkdown(option)}
                            </label>
                        `).join('')}
                    </div>
                    <button onclick="checkAnswer()">Valider la réponse</button>
                </div>
            `;
            break;

        case 'vrai_faux': 
            html += `
                <div class="vrai-faux-question">
                    <h3>Vrai ou Faux (Points: ${currentQuestion.points})</h3>
                    <p class="question-text">${questionText}</p>
                    <div class="options">
                        <label>
                            <input type="radio" name="vrai_faux_answer" value="Vrai"> Vrai
                        </label>
                        <label>
                            <input type="radio" name="vrai_faux_answer" value="Faux"> Faux
                        </label>
                    </div>
                    <button onclick="checkAnswer()">Valider la réponse</button>
                </div>
            `;
            break;

        case 'paragraphe_ia':
            html += `
                <div class="paragraphe-sujet">
                    <h3>Sujet de Rédaction (Correction IA)</h3>
                    <p class="question-text">${questionText}</p>
                    <p style="font-style: italic; color: #555;">**Attendus :** ${currentQuestion.attendus.join(' / ')}</p>
                    <textarea id="paragraphe-answer" rows="10" placeholder="Rédigez votre paragraphe ici..."></textarea>
                    <button onclick="submitParagrapheIA('${currentQuestion.consigne_ia.replace(/'/g, "\\'")}')">Soumettre à l'IA</button>
                    <div id="paragraphe-correction-ia" class="feedback-box"></div>
                </div>
            `;
            break;
            
        case 'spot_error': 
            html += `
                <div class="spot-error-question">
                    <h3>Trouver l'Erreur (Points: ${currentQuestion.points})</h3>
                    <p class="question-text">${questionText}</p>
                    <div class="error-text-box feedback-box" style="border: 2px dashed #dc3545; background-color: #f8d7da; margin-bottom: 15px;">
                        <p style="font-weight: bold; margin-bottom: 5px;">Énoncé à analyser :</p>
                        <p style="font-style: italic;">${parseMarkdown(currentQuestion.texte_avec_erreur)}</p>
                    </div>
                    <p>Quel est l'erreur dans cet énoncé et comment doit-il être corrigé ?</p>
                    <textarea id="spot_error-answer" rows="5" placeholder="L'erreur est... La correction est..."></textarea>
                    <button onclick="checkSpotErrorAnswer()">Soumettre la correction à l'IA</button>
                    <div id="spot_error-correction-ia" class="feedback-box"></div>
                </div>
            `;
            break;
            
        case 'dictation':
            html += `
                <div class="dictation-question">
                    <h3>Dictée</h3>
                    <p>La dictée sera jouée automatiquement. Écoutez attentivement et écrivez le texte dans la zone ci-dessous.</p>
                    <textarea id="dictation-answer" rows="5" placeholder="Écrivez le texte de la dictée ici..."></textarea>
                    <button onclick="submitDictation('${currentQuestion.text.replace(/'/g, "\\'")}')">Soumettre la dictée</button>
                </div>
            `;
            break;

        default:
            html = '<p class="error">Type de question inconnu.</p>';
            break;
    }

    questionContainer.innerHTML = html;
}

// --- FONCTIONS DE CORRECTION ---

// Correction pour QCM et Vrai/Faux (non IA) - (Inchangée)
function checkAnswer() {
    const currentQuestion = currentQuizData[currentQuestionIndex];
    let userAnswer = null;
    let score = 0;
    let feedback = '';
    const resultDiv = document.getElementById('correction-feedback');
    
    if (resultDiv) resultDiv.innerHTML = '';
    
    if (currentQuestion.type === 'qcm') {
        const selected = document.querySelector('input[name="qcm_answer"]:checked');
        if (!selected) { alert("Veuillez sélectionner une option."); return; }
        userAnswer = selected.value;
        
        const isCorrect = (userAnswer.trim() === currentQuestion.correct_answer.trim());
        
        if (isCorrect) {
            score = currentQuestion.points;
            feedback = `<p class="correct">✅ **Correct !**</p>`;
        } else {
            score = 0;
            feedback = `<p class="incorrect">❌ **Incorrect.** La bonne réponse était **${parseMarkdown(currentQuestion.correct_answer)}**.</p>`;
        }

    } 
    else if (currentQuestion.type === 'vrai_faux') { 
        const selected = document.querySelector('input[name="vrai_faux_answer"]:checked');
        if (!selected) { alert("Veuillez sélectionner 'Vrai' ou 'Faux'."); return; }
        userAnswer = selected.value;
        
        const isCorrect = (userAnswer.trim().toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase());
        
        if (isCorrect) {
            score = currentQuestion.points;
            feedback = `<p class="correct">✅ **Correct !**</p>`;
        } else {
            score = 0;
            feedback = `<p class="incorrect">❌ **Incorrect.** La bonne réponse était **${currentQuestion.correct_answer}**.</p>`;
        }
    }
    else {
        return;
    }
    
    userScore += score;
    resultDiv.innerHTML = feedback;
    document.getElementById('next-question-btn').style.display = 'block';
}

// Correction pour Spot the Error (via IA) - (Utilise le même endpoint de correction que le paragraphe)
async function checkSpotErrorAnswer() {
    const currentQuestion = currentQuizData[currentQuestionIndex];
    const answerElement = document.getElementById('spot_error-answer');
    const userAnswer = answerElement ? answerElement.value.trim() : '';
    const correctionDiv = document.getElementById('spot_error-correction-ia');
    const resultDiv = document.getElementById('correction-feedback'); 

    if (userAnswer.length < 10) {
        alert("Veuillez écrire votre correction de l'erreur.");
        return;
    }
    
    correctionDiv.innerHTML = '<p class="info">⏳ Envoi à l\'IA pour évaluation...</p>';
    
    // Le prompt doit contenir toutes les informations nécessaires pour l'IA
    const consigne_ia = `Vous êtes un correcteur de quiz. La tâche de l'élève était de trouver l'erreur factuelle dans l'énoncé suivant : "${currentQuestion.texte_avec_erreur}". L'erreur VRAIMENT attendue est : "${currentQuestion.correct_answer}". Votre rôle est de comparer la réponse de l'élève à l'erreur attendue et d'évaluer la qualité de sa correction sur les ${currentQuestion.points} points disponibles. Donnez des commentaires constructifs et le score obtenu.`;
    
    const userPrompt = `${consigne_ia}\nRéponse de l'élève:\n---\n${userAnswer}\n---`;
    
    try {
        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Le serveur s'attend à un objet simple contenant le prompt, le serveur gère la structure OpenAI.
            body: JSON.stringify({ prompt: userPrompt, model: "gpt-4o-mini" }) 
        });

        const aiData = await response.json();
        
        if (aiData.error) { throw new Error(aiData.error.details || aiData.error); }

        if (aiData.correction_text) {
            const formattedCorrection = parseMarkdown(aiData.correction_text);
            correctionDiv.innerHTML = `<div class="ia-feedback">${formattedCorrection}</div>`;
            
            // Extraction du score par regex (méthode non idéale mais nécessaire sans JSON structuré)
            const scoreMatch = aiData.correction_text.match(/score obtenu\s*:\s*(\d+)\s*\/\s*(\d+)/i);
            let score = 0;
            if (scoreMatch) {
                // Tenter de récupérer le score attribué (scoreMatch[1])
                score = parseInt(scoreMatch[1] || 0);
            } else {
                // Fallback: si l'IA ne renvoie pas le format exact, on attribue 0 ou 1 point si la correction semble bonne
                 score = userAnswer.toLowerCase().includes(currentQuestion.correct_answer.toLowerCase().substring(0, 10)) ? 1 : 0;
            }
            
            userScore += score;
            resultDiv.innerHTML = `<p class="correct">✅ **Correction IA fournie. Vous obtenez ${score} points (sur ${currentQuestion.points})**</p>`;

        } else {
            correctionDiv.innerHTML = '<p class="error">❌ Erreur: L\'IA n\'a pas retourné de correction valide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la correction par l'IA (Spot Error):", error);
        correctionDiv.innerHTML = `<p class="error">❌ Erreur de connexion au serveur d'IA. Détails: ${error.message}</p>`;
    }
    
    document.getElementById('next-question-btn').style.display = 'block';
}


async function submitParagrapheIA(consigne_ia) {
    const answerElement = document.getElementById('paragraphe-answer');
    const userAnswer = answerElement ? answerElement.value.trim() : '';
    const correctionDiv = document.getElementById('paragraphe-correction-ia');

    if (userAnswer.length < 50) {
        alert("Veuillez rédiger un paragraphe d'au moins 50 caractères.");
        return;
    }

    correctionDiv.innerHTML = '<p class="info">⏳ Soumission à l\'IA pour correction détaillée (cela peut prendre quelques secondes)...</p>';
    
    const userPrompt = `${consigne_ia}\n\nParagraphe de l'élève:\n---\n${userAnswer}\n---`;

    try {
        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userPrompt, model: "gpt-4o-mini" }) // Modèle utilisé pour la correction
        });

        const aiData = await response.json();
        
        if (aiData.error) { throw new Error(aiData.error.details || aiData.error); }
        
        if (aiData.correction_text) {
            const formattedCorrection = parseMarkdown(aiData.correction_text);
            correctionDiv.innerHTML = `<div class="ia-feedback">${formattedCorrection}</div>`;
        } else {
            correctionDiv.innerHTML = '<p class="error">❌ Erreur: L\'IA n\'a pas retourné de correction valide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la correction par l'IA (Paragraphe):", error);
        correctionDiv.innerHTML = `<p class="error">❌ Erreur de connexion au serveur d'IA. Détails: ${error.message}</p>`;
    }
    
    document.getElementById('next-question-btn').style.display = 'block';
}

// Dictation submission (Inchangée)
function submitDictation(originalText) {
    const answerElement = document.getElementById('dictation-answer');
    const userAnswer = answerElement ? answerElement.value.trim() : '';
    const resultDiv = document.getElementById('correction-feedback');

    if (userAnswer.length === 0) {
        alert("Veuillez écrire votre dictée.");
        return;
    }

    const normalizedUser = userAnswer.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();
    const normalizedOriginal = originalText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim();

    if (normalizedUser === normalizedOriginal) {
        resultDiv.innerHTML = `<p class="correct">✅ **Excellent !** Vous avez une orthographe et une syntaxe parfaites.</p>`;
        userScore += 1; 
        totalQuizPoints += 1;
    } else {
        resultDiv.innerHTML = `<p class="incorrect">❌ **Erreurs détectées.** Votre version contient des différences.</p>
                               <p>Version attendue : **${originalText}**</p>
                               <p>Votre version : **${userAnswer}**</p>`;
        totalQuizPoints += 1;
    }
    document.getElementById('next-question-btn').style.display = 'block';
}

// --- Navigation et Score Final (Inchangée) ---

function nextQuestion() {
    console.log("Passage à la question suivante.");
    document.getElementById('correction-feedback').innerHTML = '';
    document.getElementById('next-question-btn').style.display = 'none';

    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuizData.length) {
        displayCurrentQuestion();
    } else {
        showFinalScore();
    }
}

function showFinalScore() {
    console.log("Fin du quiz. Score utilisateur:", userScore, "Total points possibles:", totalQuizPoints);
    let feedback = `<h2>🎉 Quiz terminé !</h2>`;
    
    if (totalQuizPoints > 0) {
        const finalNote = (userScore / totalQuizPoints) * 20; 
        const finalNoteRounded = finalNote.toFixed(2);
        
        feedback += `<p>Votre performance globale est de **${userScore.toFixed(2)} / ${totalQuizPoints} points**.</p>`;
        feedback += `<h3>Votre note estimée sur 20 est : **${finalNoteRounded} / 20**</h3>`;
    } else {
         feedback += `<p>Ce quiz contenait principalement des sujets de rédaction ou des erreurs dans le calcul du score total.</p>`;
    }

    document.getElementById('question-container').innerHTML = feedback + '<button onclick="window.location.reload()">Recommencer un quiz</button>';
}
