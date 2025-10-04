// script.js (Version corrigée: Renommer 'reponse_correcte' en 'bonne_reponse' pour les QCM)

// --- FONCTIONS DE DÉBOGAGE PERSONNALISÉES ---
const debugElement = document.getElementById('debug');
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error; // Ajout pour capturer les erreurs via appendToDebug

function appendToDebug(message, type = 'log') {
    if (debugElement) {
        const p = document.createElement('p');
        p.style.whiteSpace = 'pre-wrap'; // Pour conserver les retours à la ligne dans le JSON
        p.textContent = `[${type.toUpperCase()}] ${new Date().toLocaleTimeString()} : ${message}`;
        if (type === 'error') {
            p.style.color = 'red';
        } else if (type === 'warn') {
            p.style.color = 'orange';
        } else if (type === 'info') { // Pour le JSON de la question
            p.style.color = 'blue';
        }
        debugElement.appendChild(p);
        debugElement.scrollTop = debugElement.scrollHeight;
    }
}

// Override console.log
console.log = function(...args) {
    originalConsoleLog.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'log');
};

// Override console.warn
console.warn = function(...args) {
    originalConsoleWarn.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'warn');
};

// Override console.error
console.error = function(...args) {
    originalConsoleError.apply(console, args); 
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ');
    appendToDebug(message, 'error');
};

// Modifie window.onerror pour utiliser appendToDebug
window.onerror = function(msg, url, line, col, error) {
    const errorMessage = "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
    appendToDebug(errorMessage, 'error');
    return false; 
};
// --- FIN FONCTIONS DE DÉBOGAGE PERSONNALISÉES ---

console.log("script.js chargé."); 

const MATIERES_BASE_PATH = 'matieres';
let selectedItems = []; 
let currentQuizData = []; 
let currentQuestionIndex = 0;
let totalQuizPoints = 0; 
let userScore = 0; 
let isQuizRunning = false; 

const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`; 
const GENERATION_API_URL = `${BASE_API_URL}/generation`; 

const STRUCTURE = {
    "Mathematiques": {
        "G1-STATISTIQUES": [ 
            { name: "Triangles et Proportionnalité", file: "Triangles et proportionnalité.txt" } 
        ],
        "T1_STATISTIQUES": [
            { name: "Statistiques", file: "Statistiques.txt" } 
        ]
    },
    "Histoire_Geo": {
        "Geographie": [
            { name: "Les aires urbaines", file: "Les aires urbaines.txt" } 
        ]
    },
    "Physique-Chimie": {
        "Chimie": [
            { name: "Atomes et Tableau Périodique", file: "Atomes+tableau périodique.txt" } 
        ]
    },
    "SVT": {
        "Biologie": [
            { name: "Le Phénotype", file: "Phénotype.txt" } 
        ]
    },
    "Francais": {
        "Écriture": [
            { name: "L'Autoportrait", file: "Autoportrait.txt" } 
        ]
    },
    "Anglais": {
        "Culture": [
            { name: "Les pays anglophones", file: "Les pays anglophones.txt" } 
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

document.addEventListener('DOMContentLoaded', () => {
    displayMenu();
    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
});

function displayMenu() {
    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = ''; 

    for (const matiereName in STRUCTURE) {
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        matiereDiv.innerHTML = `<h2>${matiereName}</h2>`;

        for (const chapitreName in STRUCTURE[matiereName]) {
            const chapitreDiv = document.createElement('div');
            chapitreDiv.className = 'chapitre';
            chapitreDiv.innerHTML = `<h3>${chapitreName}</h3>`;

            STRUCTURE[matiereName][chapitreName].forEach(lecon => {
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" data-path="${MATIERES_BASE_PATH}/${matiereName}/${chapitreName}/${lecon.file}" data-name="${matiereName} - ${lecon.name}"> ${lecon.name}`;
                label.querySelector('input').addEventListener('change', toggleSelection);
                chapitreDiv.appendChild(label);
            });
            matiereDiv.appendChild(chapitreDiv);
        }
        menuContainer.appendChild(matiereDiv);
    }
}

function toggleSelection(event) {
    const checkbox = event.target;
    const path = checkbox.dataset.path;
    const name = checkbox.dataset.name;

    if (checkbox.checked) {
        selectedItems.push({ path: path, name: name });
    } else {
        selectedItems = selectedItems.filter(item => item.path !== path);
    }
    updateSelectedItems();
}

function updateSelectedItems() {
    const selectedBox = document.getElementById('selected-items');
    if (selectedItems.length === 0) {
        selectedBox.innerHTML = 'Aucun sujet sélectionné';
        document.getElementById('start-quiz-btn').style.display = 'none';
    } else {
        selectedBox.innerHTML = selectedItems.map(item => item.name).join(', ');
        document.getElementById('start-quiz-btn').style.display = 'block';
    }
}


// --- Lancement et Génération du Quiz ---

async function startQuiz() {
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins un sujet.");
        return;
    }

    if (isQuizRunning) return; 
    isQuizRunning = true;
    
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';
    document.getElementById('question-container').innerHTML = '<p>Préparation du quiz... ⏳</p>';
    document.getElementById('ai-generation-feedback').innerHTML = ''; 
    
    if (debugElement) {
        debugElement.innerHTML = ''; 
        appendToDebug("Début du quiz. Vide le journal de débogage.", 'info');
    }

    currentQuizData = [];
    currentQuestionIndex = 0;
    userScore = 0;
    totalQuizPoints = 0;

    const NUM_QUESTIONS_TO_GENERATE = 5; 
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = `<p>Génération de ${NUM_QUESTIONS_TO_GENERATE} questions par sujet sélectionné (${selectedItems.length} sujet(s)).</p>`;
    
    let combinedContent = '';
    try {
        const fetchPromises = selectedItems.map(item => fetchFileContent(item.path));
        const results = await Promise.all(fetchPromises);
        combinedContent = results.join('\n\n---\n\n');
        console.log("Contenu des leçons chargé et combiné.");
    } catch (error) {
        document.getElementById('question-container').innerHTML = `<p class="error">❌ Erreur lors du chargement des fichiers de leçon. Détails: ${error.message}</p>`;
        console.error("Erreur chargement fichiers:", error);
        isQuizRunning = false;
        return;
    }
    
    try {
        const aiData = await callGenerationAPI(combinedContent, 'mixed', NUM_QUESTIONS_TO_GENERATE); 
        console.log("Données AI brutes reçues:", aiData);

        if (aiData && aiData.generated_content) {
            const jsonQuestions = JSON.parse(aiData.generated_content);
            console.log("JSON des questions parsé:", jsonQuestions);

            if (jsonQuestions.questions && Array.isArray(jsonQuestions.questions)) {
                currentQuizData = jsonQuestions.questions;
                generationFeedbackDiv.innerHTML = `<p class="correct">✅ Questions générées ! Début du quiz.</p>`;
                
                if (currentQuizData.length > 0) {
                    const firstQCM = currentQuizData.find(q => q.type === 'qcm');
                    if (firstQCM) {
                        appendToDebug("Structure de la première question QCM détectée : \n" + 
                            JSON.stringify(firstQCM, null, 2), 'info');
                    } else {
                        appendToDebug("Aucune question QCM trouvée dans les données générées.", 'warn');
                    }

                    displayCurrentQuestion();
                } else {
                    document.getElementById('question-container').innerHTML = `<p>L'IA n'a généré aucune question pour ces sujets. Veuillez réessayer.</p>`;
                    appendToDebug("L'IA n'a généré aucune question.", 'warn');
                }
            } else {
                console.error("Format JSON de l'IA invalide:", jsonQuestions);
                document.getElementById('question-container').innerHTML = `<p class="error">❌ Erreur : Le format JSON des questions générées par l'IA est invalide. Vérifiez les logs Render de votre backend.</p>`;
            }
        } else {
            console.error("Réponse de l'API de génération incomplète ou mal formée:", aiData);
            document.getElementById('question-container').innerHTML = `<p class="error">❌ L'IA n'a pas pu générer le contenu. Réponse inattendue du serveur.</p>`;
        }
    } catch (error) {
        console.error("Erreur lors de la génération par l'IA:", error);
        document.getElementById('question-container').innerHTML = `<p class="error">❌ Erreur de connexion à l'IA ou format de réponse invalide.
            Détails: ${error.message}. <br>
            Vérifiez l'URL de votre serveur Render et les logs de votre backend.
        </p>`;
        isQuizRunning = false;
    }
}

async function fetchFileContent(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Le fichier de leçon ${path} n'a pas été trouvé (Status: ${response.status}).`);
    }
    return response.text();
}

async function callGenerationAPI(topicContent, type, count) {
    let instruction = "";
    if (type === 'mixed') {
        instruction = `Génère ${count} questions de quiz basées sur le contenu de leçon suivant. Mélange des questions à choix multiples (QCM) avec une seule bonne réponse et des sujets de rédaction de paragraphe. Pour les QCM, fournis la question, une liste de 3-4 options, la bonne réponse et une courte explication. Pour les sujets de paragraphe, fournis le sujet et une consigne détaillée pour un professeur qui corrigera la réponse, en lui demandant de noter sur 10.`;
    } else if (type === 'qcm') {
        instruction = `Génère ${count} questions à choix multiples (QCM) avec une seule bonne réponse basées sur le contenu de leçon suivant. Pour chaque QCM, fournis la question, une liste de 3-4 options, la bonne réponse et une courte explication.`;
    } else if (type === 'paragraphe_ia') {
        instruction = `Génère ${count} sujets de rédaction de paragraphe basés sur le contenu de leçon suivant. Pour chaque sujet, fournis le sujet et une consigne détaillée pour un professeur qui corrigera la réponse, en lui demandant de noter sur 10.`;
    } else {
        throw new Error("Type de génération de questions inconnu.");
    }

    const full_prompt = `${instruction} Le résultat doit être un tableau JSON nommé "questions", où chaque objet représente une question, et inclut un champ "type" ("qcm" ou "paragraphe_ia"). Contenu de la leçon: """${topicContent}"""`;
    console.log("Envoi du prompt à l'API de génération:", full_prompt.substring(0, 200) + "..."); 

    const response = await fetch(GENERATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_prompt: full_prompt })
    });
    
    if (!response.ok) {
        const errorBody = await response.text(); 
        throw new Error(`Erreur réseau lors de la génération: Statut ${response.status} (${response.statusText}). Réponse du serveur: ${errorBody || "Aucun détail de réponse."}`);
    }
    return response.json();
}

async function callCorrectionAPI(prompt) {
    console.log("Envoi du prompt à l'API de correction:", prompt.substring(0, 200) + "..."); 
    const response = await fetch(CORRECTION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erreur réseau lors de la correction: Statut ${response.status} (${response.statusText}). Réponse du serveur: ${errorBody || "Aucun détail de réponse."}`);
    }
    const data = await response.json();
    console.log("Réponse de l'API de correction:", data);
    return data.correction_text;
}


// --- Affichage des questions ---

function displayCurrentQuestion() {
    const container = document.getElementById('question-container');
    const questionData = currentQuizData[currentQuestionIndex];

    if (!questionData) {
        showFinalScore(); 
        return;
    }
    console.log(`Affichage de la question ${currentQuestionIndex + 1}:`, questionData);

    container.innerHTML = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}</h3>`;
    document.getElementById('correction-feedback').innerHTML = '';
    document.getElementById('next-question-btn').style.display = 'none';


    if (questionData.type === 'qcm') {
        renderQCM(questionData, container);
    } else if (questionData.type === 'paragraphe_ia') {
        renderParagraphe(questionData, container);
    } else {
        container.innerHTML += `<p class="error">Type de question inconnu.</p>`;
        appendToDebug(`Type de question inconnu: ${questionData.type}`, 'error');
        document.getElementById('next-question-btn').style.display = 'block';
    }
}

function renderQCM(questionData, container) {
    totalQuizPoints += 1; 
    console.log("Rendu QCM. Question:", questionData.question, "Options:", questionData.options, "Bonne réponse attendue (dans les données):", questionData.bonne_reponse); // CHANGEMENT DE NOM ICI

    let html = `
        <div class="qcm-question">
            <h4>${questionData.question}</h4>
            <div id="options-container">
    `;

    questionData.options.forEach((option, index) => {
        html += `
            <label>
                <input type="radio" name="qcm-option" value="${option}">
                ${option}
            </label>
        `;
    });

    html += `
            </div>
            <button onclick="submitQCM()">Valider</button>
        </div>
    `;
    container.innerHTML += html;
}


function renderParagraphe(questionData, container) {
    totalQuizPoints += 10; 
    console.log("Rendu Paragraphe. Sujet:", questionData.sujet);

    let html = `
        <div class="paragraphe-sujet">
            <h4>Sujet de Rédaction (Noté sur 10) :</h4>
            <p>**${questionData.sujet}**</p>
            <textarea id="ia-answer" rows="10" placeholder="Rédigez votre paragraphe argumenté ici (min. 50 caractères)..."></textarea>
            <button onclick="submitParagrapheIA()">Soumettre à l'IA pour correction</button>
        </div>
    `;
    container.innerHTML += html;
}

// --- Soumission et Correction ---

function submitQCM() {
    const questionData = currentQuizData[currentQuestionIndex];
    const optionsContainer = document.getElementById('options-container');
    const resultDiv = document.getElementById('correction-feedback');
    const selectedOption = document.querySelector('input[name="qcm-option"]:checked');

    if (!selectedOption) {
        alert("Veuillez sélectionner une réponse.");
        appendToDebug("Tentative de soumission QCM sans option sélectionnée.", 'warn');
        return;
    }

    const userAnswer = selectedOption.value;
    const correctAnswer = questionData.bonne_reponse; // <<< LE CHANGEMENT CRUCIAL EST ICI !!!
    console.log("Réponse utilisateur QCM:", userAnswer, " | Réponse correcte attendue:", correctAnswer);


    optionsContainer.querySelectorAll('input').forEach(input => input.disabled = true);
    document.querySelector('.qcm-question button').style.display = 'none'; 

    let feedback = '';
    if (userAnswer === correctAnswer) {
        feedback = `<p class="correct">✅ **Bonne réponse !** Vous gagnez 1 point.</p>`;
        userScore += 1;
        console.log("Bonne réponse QCM.");
    } else {
        feedback = `<p class="incorrect">❌ **Mauvaise réponse.**</p>`;
        console.log("Mauvaise réponse QCM.");
    }
    
    // Afficher l'explication et la bonne réponse (maintenant elle ne sera plus undefined)
    feedback += `<p>La bonne réponse était : **${correctAnswer}**.</p>`; 
    if (questionData.explication) {
        feedback += `<p>Explication : ${questionData.explication}</p>`;
    }

    resultDiv.innerHTML = feedback;
    document.getElementById('next-question-btn').style.display = 'block';
}


async function submitParagrapheIA() {
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('ia-answer').value.trim();
    const resultDiv = document.getElementById('correction-feedback');

    if (userAnswer.length < 50) {
        alert("Veuillez écrire un paragraphe plus long (minimum 50 caractères).");
        appendToDebug("Tentative de soumission Paragraphe trop court.", 'warn');
        return;
    }
    
    document.getElementById('ia-answer').disabled = true;
    document.querySelector('.paragraphe-sujet button').disabled = true;

    resultDiv.innerHTML = '<p>Correction par l\'IA en cours... 🧠</p>';
    
    const horsSujetRule = "RÈGLE CRITIQUE : Si le texte de l'élève est manifestement **hors sujet** (parle d'une autre notion que le sujet demandé), la note doit être **0/10** et vous devez le mentionner clairement dans vos commentaires.";
    
    const prompt = `${questionData.consigne_ia} ${horsSujetRule}\n\nTexte de l'élève à corriger:\n\n---\n${userAnswer}\n---`;
    
    try {
        const responseText = await callCorrectionAPI(prompt); 
        
        const scoreMatch = responseText.match(/Note\s*:\s*(\d+(\.\d+)?)\s*\/\s*10/i);
        let iaScore = 0;
        if (scoreMatch) {
            iaScore = parseFloat(scoreMatch[1]);
            userScore += iaScore; 
            console.log("Score IA extrait pour paragraphe:", iaScore);
        } else {
             console.warn("L'IA n'a pas retourné une note lisible dans le format 'Note: X/10'. Score non ajouté au total.");
        }
        
        resultDiv.innerHTML = `<div class="ia-feedback">${responseText}</div>`;
        document.getElementById('next-question-btn').style.display = 'block';

    } catch (error) {
        console.error("Erreur lors de la correction:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA lors de la correction.
            Détails: ${error.message}. <br>
            Vérifiez l'URL de votre serveur Render et les logs de votre backend.
        </p>`;
    }
}

// --- Navigation ---

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
         feedback += `<p>Ce quiz ne contenait que des sujets de rédaction dont le score n'a pas pu être extrait pour le calcul final.</p>`;
    }

    document.getElementById('question-container').innerHTML = feedback + '<button onclick="window.location.reload()">Recommencer</button>';
    isQuizRunning = false;
}
