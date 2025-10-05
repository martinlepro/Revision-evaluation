// script.js (Version complète et corrigée)

// --- FONCTIONS DE DÉBOGAGE PERSONNALISÉES (Utilisées pour le pré/debug en bas de page) ---
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
            p.style.color = 'red';
        } else if (type === 'warn') {
            p.style.color = 'orange';
        } else if (type === 'info') {
            p.style.color = 'blue';
        }
        debugElement.appendChild(p);
        debugElement.scrollTop = debugElement.scrollHeight;
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


// --- Variables Globales ---
const MATIERES_BASE_PATH = 'matieres';
let selectedItems = []; // Tableau pour stocker les objets de sélection { path, name }
let currentQuizData = []; // Données des questions générées par l'IA
let currentQuestionIndex = 0;
let totalQuizPoints = 0; // Total des points des questions notées (QCM/VraiFaux)
let userScore = 0; // Score obtenu par l'utilisateur
let isQuizRunning = false;
let config = {};

// URL de votre serveur proxy sécurisé sur Render
const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`;
const GENERATION_API_URL = `${BASE_API_URL}/generation`;
const TTS_API_URL = `${BASE_API_URL}/tts`;

console.log("BASE_API_URL:", BASE_API_URL);

// --- Gestion de la structure des matières (Catalogue des leçons) ---
// CORRECTION DÉFINITIVE DES CHEMINS POUR MUSIQUE ET TECHNOLOGIE (Les clés 'musique' et 'technologie' doivent correspondre aux noms de dossiers)
const STRUCTURE = {
    "Anglais": {
        "Culture": [ 
            { name: "Les pays anglophones", file: "Les pays anglophones.txt" } 
        ]
    },
    "Francais": {
        "Analyse": [
            { name: "Analyse d'un texte", file: "Analyse d'un texte .txt" } 
        ],
        "Écriture": [ 
            { name: "L'Autoportrait", file: "Autoportrait.txt" },
            { name: "Qui est je", file: "Qui est je.txt" } 
        ],
        "Grammaire": [
            { name: "L'accord du verbe et du sujet", file: "L'accord du verbe et du sujet .txt" },
            { name: "Les classes grammaticales", file: "Les classes grammaticales.txt" }
        ],
        "Conjugaison": [
            { name: "Les Temps Simples de l'Indicatif", file: "Les Temps Simples de l'Indicatif.txt" }
        ]
    },
    "Histoire_Geo": {
        "Geographie": [ 
            { name: "Les aires urbaines", file: "Les aires urbaines.txt" } 
        ]
    },
    "Mathematiques": {
        "G1-Triangles et proportionnalité": [ 
            { name: "Triangles et proportionnalité", file: "Triangles et proportionnalité.txt" } 
        ],
        "T1_STATISTIQUES": [ 
            { name: "Statistiques", file: "Statistiques.txt" } 
        ]
    },
    "Physique-Chimie": {
        "Chimie": [ 
            { name: "Atomes et Tableau Périodique", file: "Atomes+tableau périodique.txt" } 
        ]
    },
    "Science-de-la-Vie-et-de-la-Terre": { 
        "Biologie": [ 
            { name: "L'Hérédité (Génétique)", file: "L'Hérédité (Génétique).txt" },
            { name: "Le programme génétique", file: "Le programme génétique.txt" }
        ]
    },
    "Musique": {
        "Histoire": [ 
            { name: "La Chanson Engagée", file: "Chanson engagée.txt" } 
        ]
    },
    "Technologie": {
        "Systèmes": [ 
            { name: "Les systèmes automatisés", file: "Les-systèmes-automatisés.txt" } 
        ]
    }
};

// --- FONCTIONS DE MISE EN FORME ---
/**
 * Convertit le format Markdown **...** en gras et souligné (HTML).
 * @param {string} text Le texte à modifier.
 * @returns {string} Le texte avec les surlignages appliqués.
 */
function parseMarkdown(text) {
    // Utilise la regex pour trouver **texte** et le remplacer par <span class="bold-underline">texte</span>
    // Le $1 représente le contenu capturé entre les deux étoiles.
    return text.replace(/\*\*(.*?)\*\*/g, '<span class="bold-underline">$1</span>');
}


// --- FONCTIONS DE DÉMARRAGE ET DE CHARGEMENT ---

// Écouteurs d'événements pour le démarrage de l'application
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    renderMenu();

    // Gestion des boutons de démarrage
    document.getElementById('start-quiz-btn').addEventListener('click', () => startQuiz());
    document.getElementById('start-qcm-btn').addEventListener('click', () => startQuiz('qcm')); // Démarrage QCM seul
    document.getElementById('start-paragraphe-btn').addEventListener('click', () => startQuiz('paragraphe_ia')); // Démarrage Paragraphe seul
    document.getElementById('start-dictation-btn').addEventListener('click', () => startQuiz('dictation')); // Démarrage Dictée
    
    // Écouteur pour le bouton de la question suivante
    document.getElementById('next-question-btn').addEventListener('click', nextQuestion);
});

async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        config = await response.json();
        console.log("Configuration chargée:", config);
    } catch (error) {
        console.error("Erreur lors du chargement de config.json:", error);
        alert("Erreur critique: Impossible de charger la configuration (config.json).");
    }
}

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
    // Les clés de la STRUCTURE (ex: 'musique', 'Leçons', 'Chanson engagée.txt') sont utilisées
    // pour construire le chemin vers le dossier 'matieres'.
    // Ex: matieres/musique/Leçons/Chanson engagée.txt
    return `${matiere}/${subMatiere}/${item.file}`;
}

function toggleSelection(checkbox) {
    const path = checkbox.dataset.path;
    const name = checkbox.dataset.name;

    if (checkbox.checked) {
        if (!selectedItems.some(item => item.path === path)) {
            selectedItems.push({ path, name });
        }
    } else {
        selectedItems = selectedItems.filter(item => item.path !== path);
    }
    updateSelectedBox();
}

function updateSelectedBox() {
    const selectedText = selectedItems.map(item => item.name).join(', ');
    document.getElementById('selected-items').textContent = selectedItems.length > 0 ? selectedText : 'Aucun sujet sélectionné.';
}

async function startQuiz(quizType = 'mixte') {
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins un sujet de révision.");
        return;
    }
    if (isQuizRunning) return;
    isQuizRunning = true;

    // Réinitialisation du quiz
    currentQuizData = [];
    currentQuestionIndex = 0;
    userScore = 0;
    totalQuizPoints = 0;
    
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';
    document.getElementById('question-container').innerHTML = '<p>Génération du quiz en cours, veuillez patienter...</p>';

    // Début de la génération des questions pour chaque sujet sélectionné
    for (const item of selectedItems) {
        if (quizType === 'dictation') {
             // Pour les dictées, on génère directement la question et on ne continue pas la boucle
            await generateDictationQuestion(item.path);
            break; // Une seule dictée suffit pour un "quiz" de dictée
        }

        const content = await fetchContent(item.path);
        if (content) {
            console.log(`Contenu de ${item.name} chargé. Génération de question de type ${quizType}...`);
            await generateRandomQuestionFromContent(content, quizType, item.name);
        }
    }
    
    isQuizRunning = false; // La génération est terminée

    if (currentQuizData.length > 0) {
        displayCurrentQuestion();
    } else if (quizType !== 'dictation') {
        alert("Aucune question n'a pu être générée. Vérifiez la connexion à l'API ou le format des fichiers de leçons.");
        document.getElementById('quiz-view').style.display = 'none';
        document.getElementById('selection-view').style.display = 'block';
    }
}

async function fetchContent(filePath) {
    const fullPath = `${MATIERES_BASE_PATH}/${filePath}`;
    console.log("Tentative de chargement du fichier:", fullPath);

    try {
        const response = await fetch(fullPath);
        if (!response.ok) {
            // L'erreur de chemin non trouvé est loggée ici
            throw new Error(`Erreur HTTP: ${response.status} - Le chemin n'est pas trouvable pour: ${fullPath}`);
        }
        // Gère les fichiers JSON (pour les sujets de paragraphe pré-écrits)
        if (fullPath.endsWith('.json')) {
            return await response.json();
        }
        return await response.text();
    } catch (error) {
        console.error("Erreur de chargement du contenu:", error);
        alert(`Erreur critique: ${error.message}.`);
        return null;
    }
}

// --- LOGIQUE DE GÉNÉRATION IA ---

/**
 * Génère une question aléatoire (QCM, Paragraphe, Vrai/Faux) à partir d'un contenu de leçon.
 * @param {string|object} content Le contenu de la leçon (texte ou objet JSON).
 * @param {string} forcedType 'qcm', 'paragraphe_ia', 'vrai_faux' ou 'mixte'.
 * @param {string} sourceName Nom du sujet pour le contexte.
 */
async function generateRandomQuestionFromContent(content, forcedType, sourceName) {
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = '<p class="info">⏳ Contact de l\'IA pour la génération...</p>';
    
    // Détermine le type de question à générer
    let questionTypesToGenerate = ['qcm', 'paragraphe_ia', 'vrai_faux']; // NOUVEAU: Ajout de 'vrai_faux'
    let contentType = forcedType === 'mixte' 
        ? questionTypesToGenerate[Math.floor(Math.random() * questionTypesToGenerate.length)]
        : forcedType;

    // Pour les sujets de paragraphe pré-écrits (fichiers JSON), on les ajoute directement
    if (typeof content === 'object' && content.type === 'paragraphe_ia') {
        content.sourceName = sourceName;
        currentQuizData.push(content);
        if (content.points) { // Si le JSON inclut des points pour le calcul du score
             totalQuizPoints += content.points;
        }
        generationFeedbackDiv.innerHTML = `<p class="correct">✅ Sujet de paragraphe pour **${sourceName}** ajouté.</p>`;
        return;
    }

    let systemPrompt = `À partir du contenu de la leçon suivant, générez une seule question au format JSON. Votre rôle est d'être un générateur de questions pour un élève de 3e.`;
    let userPrompt = `Contenu de la leçon:\n---\n${content}\n---\n`;
    
    // Contraintes pour le type de question
    if (contentType === 'qcm') {
        systemPrompt += ` Le format JSON doit être: {"type": "qcm", "question": "...", "options": ["...", "..."], "correct_answer": "...", "points": 1}`;
        userPrompt += `Générez une question à choix multiples (QCM) de niveau 3e avec 4 options.`;
    } else if (contentType === 'paragraphe_ia') {
        systemPrompt += ` Le format JSON doit être: {"type": "paragraphe_ia", "sujet": "...", "attendus": ["..."], "consigne_ia": "..."}`;
        userPrompt += `Générez un sujet de paragraphe argumenté ou de développement construit pour élève de 3e, avec un sujet, 3 attendus (points clés à inclure) et une consigne de correction détaillée pour l'IA.`;
    } else if (contentType === 'vrai_faux') { // NOUVEAU TYPE
        systemPrompt += ` Le format JSON doit être: {"type": "vrai_faux", "question": "...", "correct_answer": "Vrai" ou "Faux", "points": 1}`;
        userPrompt += `Générez une question Vrai/Faux de niveau 3e. La réponse doit être strictement "Vrai" ou "Faux" (avec une majuscule).`;
    } else {
        console.error("Type de question invalide pour la génération aléatoire:", contentType);
        generationFeedbackDiv.innerHTML = '<p class="error">❌ Type de question IA invalide.</p>';
        return;
    }

    // Appel à l'API de génération
    try {
        const response = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ systemPrompt, userPrompt })
        });

        const aiData = await response.json();
        
        if (aiData.error) {
            throw new Error(aiData.error.details || aiData.error);
        }
        
        if (aiData.generated_content) {
            // Le contenu généré est une chaîne JSON
            const jsonString = aiData.generated_content.replace(/```json|```/g, '').trim();
            const generatedQuestion = JSON.parse(jsonString);
            
            if (generatedQuestion.type === contentType) {
                generatedQuestion.sourceName = sourceName;
                currentQuizData.push(generatedQuestion);
                
                // Ajoute les points au total si la question est notée (QCM, Vrai/Faux)
                if (generatedQuestion.points) {
                    totalQuizPoints += generatedQuestion.points;
                }
                
                generationFeedbackDiv.innerHTML = `<p class="correct">✅ Question de type **${contentType}** pour **${sourceName}** générée.</p>`;
            } else {
                 generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA a généré un type de contenu inattendu.</p>';
                 console.error("Type de contenu généré par l'IA ne correspond pas au type demandé. Attendu:", contentType, "Reçu:", generatedQuestion.type);
            }
        } else {
            console.error("Réponse de l'API de génération incomplète ou mal formée (aléatoire): 'generated_content' manquant.", aiData);
            generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA n\'a pas pu générer le contenu. Réponse inattendue du serveur.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la génération par l'IA (aléatoire):", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA ou format de réponse invalide. Détails: ${error.message}</p>`;
        // En cas d'erreur grave, on pourrait vouloir revenir à la sélection
        // document.getElementById('quiz-view').style.display = 'none';
        // document.getElementById('selection-view').style.display = 'block';
    }
}

// --- LOGIQUE DE GÉNÉRATION DE DICTÉE ---

async function generateDictationQuestion(filePath) {
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = '<p class="info">⏳ Contact de l\'IA pour la génération de la dictée...</p>';
    
    // 1. Récupère la leçon
    const content = await fetchContent(filePath);
    if (!content) {
         generationFeedbackDiv.innerHTML = '<p class="error">❌ Erreur de chargement du contenu pour la dictée.</p>';
         return;
    }
    
    // 2. Demande à l'IA de sélectionner une phrase pour la dictée et de renvoyer le texte exact
    const dictationSystemPrompt = `À partir du contenu de la leçon suivant, sélectionnez **une seule phrase** qui est la plus pertinente pour une dictée pour un élève de 3e. Retournez UNIQUEMENT la phrase sélectionnée, sans aucun autre commentaire ou formatage.`;
    const dictationUserPrompt = `Contenu de la leçon:\n---\n${content}\n---\n`;

    let dictationText = '';
    
    try {
        const response = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ systemPrompt: dictationSystemPrompt, userPrompt: dictationUserPrompt })
        });
        
        const aiData = await response.json();
        
        if (aiData.error) {
            throw new Error(aiData.error.details || aiData.error);
        }
        
        // Le contenu généré est la phrase brute
        dictationText = aiData.generated_content.trim(); 
        
        if (!dictationText) {
            throw new Error("L'IA n'a pas retourné de texte de dictée valide.");
        }
        
        generationFeedbackDiv.innerHTML = `<p class="correct">✅ Texte de dictée généré. Préparation de la lecture audio...</p>`;
        
        // 3. Demande de génération TTS pour l'audio
        await generateAndPlayTTS(dictationText);
        
        // 4. Ajout de la "question" de dictée au quiz pour l'affichage final
         currentQuizData.push({
            type: 'dictation',
            text: dictationText,
            sourceName: selectedItems[0].name // Utilise le nom du premier sujet
        });
        
    } catch (error) {
        console.error("Erreur lors de la génération de la dictée:", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur lors de la génération de la dictée (texte ou audio). Détails: ${error.message}</p>`;
    }
}

async function generateAndPlayTTS(text) {
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = '<p class="info">🔊 Lecture audio en cours...</p>';

    try {
        // L'API TTS est conçue pour renvoyer le flux audio directement
        const response = await fetch(TTS_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });

        if (!response.ok) {
            const errorText = await response.text();
             throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
        }
        
        // Crée un objet Blob à partir de la réponse binaire (le fichier MP3)
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Crée l'élément audio et joue le son
        const audioElement = document.getElementById('dictation-audio') || document.createElement('audio');
        audioElement.id = 'dictation-audio';
        audioElement.src = audioUrl;
        audioElement.controls = true;
        
        // Ajoute l'élément audio au conteneur de question
        const questionContainer = document.getElementById('question-container');
        questionContainer.innerHTML = '<h2>Dictée</h2><p>Écoutez la phrase et écrivez-la.</p>';
        questionContainer.appendChild(audioElement);
        
        generationFeedbackDiv.innerHTML = '<p class="correct">✅ Audio prêt. Cliquez sur "Play" ci-dessus.</p>';
        
    } catch (error) {
        console.error("Erreur lors de la génération TTS:", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur lors de la génération audio (TTS). Détails: ${error.message}</p>`;
    }
}


// --- FONCTIONS D'AFFICHAGE DU QUIZ ---

function displayCurrentQuestion() {
    if (currentQuestionIndex >= currentQuizData.length) {
        showFinalScore();
        return;
    }
    
    // Cache le feedback de correction précédent
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    if (correctionFeedbackDiv) correctionFeedbackDiv.innerHTML = '';
    
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) nextQuestionBtn.style.display = 'none';

    const currentQuestion = currentQuizData[currentQuestionIndex];
    const questionContainer = document.getElementById('question-container');
    let html = '';

    // Applique le surlignage Markdown sur le texte de la question/sujet
    const questionText = parseMarkdown(currentQuestion.question || currentQuestion.sujet || currentQuestion.text);
    
    // Affichage du statut de progression
    html += `<h3 style="margin-bottom: 20px;">Question ${currentQuestionIndex + 1} sur ${currentQuizData.length} (Source : ${currentQuestion.sourceName})</h3>`;

    switch (currentQuestion.type) {
        case 'qcm':
            html += `
                <div class="qcm-question">
                    <h3>Question à Choix Multiples (Points: ${currentQuestion.points})</h3>
                    <p class="question-text">${questionText}</p>
                    <div class="options">
                        ${currentQuestion.options.map((option, index) => `
                            <label>
                                <input type="radio" name="qcm_answer" value="${option}"> ${parseMarkdown(option)}
                            </label>
                        `).join('')}
                    </div>
                    <button onclick="checkAnswer()">Valider la réponse</button>
                </div>
            `;
            break;

        case 'paragraphe_ia':
            html += `
                <div class="paragraphe-sujet">
                    <h3>Sujet de Rédaction</h3>
                    <p class="question-text">${questionText}</p>
                    <p style="font-style: italic; color: #555;">**Attendus :** ${currentQuestion.attendus.join(' / ')}</p>
                    <textarea id="paragraphe-answer" rows="10" placeholder="Rédigez votre paragraphe ici..."></textarea>
                    <button onclick="submitParagrapheIA('${currentQuestion.consigne_ia}')">Soumettre à l'IA</button>
                    <div id="paragraphe-correction-ia" class="feedback-box"></div>
                </div>
            `;
            break;
            
        case 'vrai_faux': // NOUVEAU TYPE
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
            
        case 'dictation':
            html = `
                <div class="dictation-question">
                    <h2>Dictée</h2>
                    <p>Écoutez et transcrivez la phrase de **${currentQuestion.sourceName}**.</p>
                    <div id="dictation-audio-container" style="margin: 20px 0;">
                        </div>
                    <textarea id="dictation-answer" rows="5" placeholder="Écrivez la phrase ici..."></textarea>
                    <button onclick="submitDictation('${currentQuestion.text}')">Corriger la Dictée</button>
                    <div id="dictation-correction-ia" class="feedback-box"></div>
                </div>
            `;
            // L'audio doit être rechargé pour cette vue
            generateAndPlayTTS(currentQuestion.text);
            break;


        default:
            html = '<p class="error">Type de question inconnu.</p>';
            break;
    }

    questionContainer.innerHTML = html;
}

// --- FONCTIONS DE CORRECTION ---

// Correction pour QCM et Vrai/Faux (non IA)
function checkAnswer() {
    const currentQuestion = currentQuizData[currentQuestionIndex];
    let userAnswer = null;
    let score = 0;
    let feedback = '';
    const resultDiv = document.getElementById('correction-feedback');
    
    // Réinitialise le feedback
    if (resultDiv) resultDiv.innerHTML = '';
    
    // Gère la correction QCM
    if (currentQuestion.type === 'qcm') {
        const selected = document.querySelector('input[name="qcm_answer"]:checked');
        if (!selected) {
            alert("Veuillez sélectionner une option.");
            return;
        }
        userAnswer = selected.value;
        
        // Correction QCM
        const isCorrect = (userAnswer.trim() === currentQuestion.correct_answer.trim());
        
        if (isCorrect) {
            score = currentQuestion.points;
            feedback = `<p class="correct">✅ **Correct !** La bonne réponse était **${parseMarkdown(currentQuestion.correct_answer)}**.</p>`;
        } else {
            score = 0;
            feedback = `<p class="incorrect">❌ **Incorrect.** Votre réponse était **${parseMarkdown(userAnswer)}**. La bonne réponse était **${parseMarkdown(currentQuestion.correct_answer)}**.</p>`;
        }

    } 
    // Gère la correction VRAI/FAUX (NOUVEAU)
    else if (currentQuestion.type === 'vrai_faux') { 
        const selected = document.querySelector('input[name="vrai_faux_answer"]:checked');
        if (!selected) {
            alert("Veuillez sélectionner 'Vrai' ou 'Faux'.");
            return;
        }
        userAnswer = selected.value;
        
        // Correction Vrai/Faux
        const isCorrect = (userAnswer.trim().toLowerCase() === currentQuestion.correct_answer.trim().toLowerCase());
        
        if (isCorrect) {
            score = currentQuestion.points;
            feedback = `<p class="correct">✅ **Correct !** La bonne réponse était **${currentQuestion.correct_answer}**.</p>`;
        } else {
            score = 0;
            feedback = `<p class="incorrect">❌ **Incorrect.** Votre réponse était **${userAnswer}**. La bonne réponse était **${currentQuestion.correct_answer}**.</p>`;
        }
    }
    else {
        console.warn("Correction manuelle appelée pour un type de question non prévu (Paragraphe ou Dictée).");
        return;
    }
    
    userScore += score;
    resultDiv.innerHTML = feedback;
    document.getElementById('next-question-btn').style.display = 'block';
}


// Correction pour Paragraphe (via IA)
async function submitParagrapheIA(consigne_ia) {
    const answerElement = document.getElementById('paragraphe-answer');
    const answer = answerElement ? answerElement.value.trim() : '';
    const correctionDiv = document.getElementById('paragraphe-correction-ia');

    if (answer.length < 50) {
        alert("Veuillez rédiger un paragraphe d'au moins 50 caractères pour que l'IA puisse le corriger correctement.");
        return;
    }
    
    correctionDiv.innerHTML = '<p class="info">⏳ Envoi à l\'IA pour correction...</p>';
    
    // Le prompt final combine la consigne de correction et la réponse de l'élève
    const userPrompt = `Voici la consigne de correction de l'IA: "${consigne_ia}".\nVoici le paragraphe de l'élève à corriger:\n---\n${answer}\n---`;
    
    try {
        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt: userPrompt })
        });

        const aiData = await response.json();
        
        if (aiData.error) {
            throw new Error(aiData.error.details || aiData.error);
        }

        if (aiData.correction_text) {
             // Applique le surlignage Markdown à la correction
            const formattedCorrection = parseMarkdown(aiData.correction_text);
            correctionDiv.innerHTML = `<div class="ia-feedback">${formattedCorrection}</div>`;
        } else {
            console.error("Réponse de l'API de correction incomplète ou mal formée.", aiData);
            correctionDiv.innerHTML = '<p class="error">❌ Erreur: L\'IA n\'a pas retourné de correction valide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la correction par l'IA:", error);
        correctionDiv.innerHTML = `<p class="error">❌ Erreur de connexion au serveur d'IA. Détails: ${error.message}</p>`;
    }
    
    // Après la correction, permettre de passer à la question suivante
    document.getElementById('next-question-btn').style.display = 'block';
}


// Correction pour Dictée (via IA)
async function submitDictation(correctText) {
    const answerElement = document.getElementById('dictation-answer');
    const userAnswer = answerElement ? answerElement.value.trim() : '';
    const correctionDiv = document.getElementById('dictation-correction-ia');

    if (userAnswer.length < 10) {
        alert("Veuillez entrer le texte de la dictée.");
        return;
    }
    
    correctionDiv.innerHTML = '<p class="info">⏳ Envoi à l\'IA pour correction de la dictée...</p>';
    
    // Consigne IA pour la correction de dictée
    const consigne_ia = `Vous êtes un correcteur de dictée de 3e. Comparez le texte de l'élève au texte correct. Listez les erreurs (orthographe, grammaire, ponctuation) et donnez des commentaires constructifs. Ne donnez pas de note. Le texte original était: "${correctText}".`;
    
    const userPrompt = `${consigne_ia}\nTexte de l'élève:\n---\n${userAnswer}\n---`;

    try {
        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: userPrompt })
        });

        const aiData = await response.json();
        
        if (aiData.error) {
            throw new Error(aiData.error.details || aiData.error);
        }

        if (aiData.correction_text) {
             // Applique le surlignage Markdown à la correction
            const formattedCorrection = parseMarkdown(aiData.correction_text);
            correctionDiv.innerHTML = `<div class="ia-feedback">${formattedCorrection}</div>`;
        } else {
            console.error("Réponse de l'API de correction incomplète ou mal formée.", aiData);
            correctionDiv.innerHTML = '<p class="error">❌ Erreur: L\'IA n\'a pas retourné de correction valide.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la correction de la dictée par l'IA:", error);
        correctionDiv.innerHTML = `<p class="error">❌ Erreur de connexion au serveur d'IA. Détails: ${error.message}</p>`;
    }
    
    // Après la correction, permettre de passer à la question suivante
    document.getElementById('next-question-btn').style.display = 'block';
}


// --- Navigation ---

function nextQuestion() {
    console.log("Passage à la question suivante.");
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    if (correctionFeedbackDiv) {
        correctionFeedbackDiv.innerHTML = '';
    }
    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.style.display = 'none';
    }

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
    
    // On ne calcule la note sur 20 que si des questions ont été notées (QCM ou Vrai/Faux).
    if (totalQuizPoints > 0) {
        // Note sur 20 calculée à partir du score obtenu / score total des questions générées
        const finalNote = (userScore / totalQuizPoints) * 20; 
        const finalNoteRounded = finalNote.toFixed(2);
        
        feedback += `<p>Votre performance globale est de **${userScore.toFixed(2)} / ${totalQuizPoints} points**.</p>`;
        feedback += `<h3>Votre note estimée sur 20 est : **${finalNoteRounded} / 20**</h3>`;
    } else {
         feedback += `<p>Ce quiz ne contenait que des sujets de rédaction (paragraphes) ou des dictées. L'évaluation de l'IA doit être lue dans les commentaires précédents.</p>`;
    }

    document.getElementById('question-container').innerHTML = feedback + '<button onclick="window.location.reload()">Recommencer</button>';
        }
