// script.js (Début du fichier, incluant la nouvelle structure de fichiers .txt)

window.onerror = function(msg, url, line, col, error) {
    document.getElementById('debug').textContent =
      "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
};
console.log("script.js chargé.");

const MATIERES_BASE_PATH = 'matieres';
let selectedItems = []; // Stocke les objets de leçon sélectionnés { path, name }
let currentQuizData = []; // Données des questions générées par l'IA
let currentQuestionIndex = 0;
let totalQuizPoints = 0; 
let userScore = 0; 
let isQuizRunning = false; 

// URL de votre serveur proxy sécurisé sur Render
const BASE_API_URL = 'https://cle-api.onrender.com';
const CORRECTION_API_URL = `${BASE_API_URL}/correction`; 
const GENERATION_API_URL = `${BASE_API_URL}/generation`; 

// --- Gestion de la structure des matières (Catalogue des leçons) ---
// La propriété 'type' a été RETIRÉE. Le type de question est choisi aléatoirement par l'IA.
const STRUCTURE = {
    "Mathematiques": {
        "G1_STATISTIQUES": [
            { name: "Triangles et Proportionnalité", file: "Triangles et proportionnalité.txt" } 
        ],
        "T1_STATISTIQUES": [
            { name: "Statistiques", file: "Statistiques.txt" } 
        ]
    },
    "Histoire_Geo": {
        "Les_Aires_Urbaines": [
            { name: "Les Aires Urbaines", file: "Les aires urbaines.txt" }
        ]
    },
    "Physique_Chimie": {
        "Atomes_et_Tableau_Periodique": [
            { name: "Atomes et Tableau Périodique", file: "Atomes+tableau périodique.txt" }
        ]
    },
    "Anglais": {
        "Les_Pays_Anglophones": [
            { name: "Les Pays Anglophones", file: "Les pays anglophones.txt" }
        ]
    },
    "Science_de_la_Vie_et_de_la_Terre": { // Nom complet pour correspondre au chemin
        "Le_Phenotype": [
            { name: "Le Phénotype", file: "Phénotype.txt" }
        ]
    },
    "Technologie": {
        "Systemes_Automatises": [
            { name: "Les Systèmes Automatisés", file: "Les-systèmes-automatisés.txt" }
        ]
    },
    "Musique": {
        "Chanson_Engagee": [
            { name: "La Chanson Engagée", file: "Chanson engagée.txt" }
        ]
    },
    "Francais": {
        "Autoportrait": [
            { name: "L'Autoportrait", file: "Autoportrait.txt" }
        ]
    }
};

// --- Initialisation et chargement des ressources ---

document.addEventListener('DOMContentLoaded', () => {
    loadStructure();
    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz); 
});

function loadStructure() {
    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = '';

    for (const matiere in STRUCTURE) {
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        // Affiche la clé Matière en remplaçant les _ par des espaces pour la lisibilité
        matiereDiv.innerHTML = `<h2>${matiere.replace(/_/g, ' ')}</h2>`;
        
        const ul = document.createElement('ul');

        for (const chapitre in STRUCTURE[matiere]) {
            const chapitreLi = document.createElement('li');
            // Affiche la clé Chapitre en remplaçant les _ par des espaces pour la lisibilité
            chapitreLi.innerHTML = `<h3>${chapitre.replace(/_/g, ' ')}</h3>`;
            const itemsList = document.createElement('ul');

            STRUCTURE[matiere][chapitre].forEach(itemObject => { 
                const itemLi = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                
                // Le chemin d'accès au fichier est reconstruit ici : matieres/Matiere/Chapitre/Fichier.txt
                const chapterPath = `${matiere}/${chapitre}`;
                const fullPath = `${MATIERES_BASE_PATH}/${chapterPath}/${itemObject.file}`;
                
                // L'objet stocké dans le dataset ne contient que le chemin et le nom
                checkbox.dataset.item = JSON.stringify({ 
                    path: fullPath,
                    name: itemObject.name
                });
                
                checkbox.id = fullPath;
                checkbox.addEventListener('change', updateSelection);

                const label = document.createElement('label');
                label.htmlFor = fullPath;
                // Affiche uniquement le nom de la leçon
                label.textContent = itemObject.name; 

                itemLi.appendChild(checkbox);
                itemLi.appendChild(label);
                itemsList.appendChild(itemLi);
            });
            
            chapitreLi.appendChild(itemsList);
            ul.appendChild(chapitreLi);
        }
        matiereDiv.appendChild(ul);
        menuContainer.appendChild(matiereDiv);
    }
}

function updateSelection(event) {
    const itemObject = JSON.parse(event.target.dataset.item);

    if (event.target.checked) {
        selectedItems.push(itemObject);
    } else {
        selectedItems = selectedItems.filter(item => item.path !== itemObject.path);
    }
    
    const selectionDisplay = document.getElementById('selected-items');
    selectionDisplay.textContent = selectedItems.map(item => item.name).join(' | ');
}
// --- Logique principale du Quiz (Mise à jour pour le tirage aléatoire) ---

// Fonction pour choisir aléatoirement le type de question à générer
function determineQuestionType() {
    // 33% de chance pour chaque type de question, si la leçon s'y prête.
    const random = Math.random(); 

    if (random < 0.33) {
        return 'qcm';
    } else if (random < 0.66) {
        // Le type 'paragraphe' est le plus exigeant pour l'élève (longue réponse).
        return 'paragraphe';
    } else {
        // 'reponse_ouverte' est une question simple sans QCM, corrigée par l'IA.
        return 'reponse_ouverte';
    }
}


async function startQuiz() {
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins une leçon à réviser !");
        return;
    }
    
    if (isQuizRunning) {
        console.log("Quiz déjà en cours de génération/exécution.");
        return;
    }
    isQuizRunning = true; 
    
    userScore = 0;
    totalQuizPoints = 0;

    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';

    currentQuizData = []; 
    
    // Le quiz aura un nombre de questions égal au nombre de leçons sélectionnées
    for (const lesson of selectedItems) {
        try {
            // Déterminer le type de question à générer pour CETTE leçon
            const questionType = determineQuestionType();

            document.getElementById('question-container').innerHTML = `<h2>🧠 Génération d'une question de type **${questionType.toUpperCase()}** basée sur **${lesson.name}** en cours...</h2>`;
            
            // 1. Récupérer le contenu brut de la leçon (.txt)
            const lessonResponse = await fetch(lesson.path);
            if (!lessonResponse.ok) {
                throw new Error(`Le fichier de leçon ${lesson.path} n'a pas été trouvé (Status: ${lessonResponse.status}).`);
            }
            const lessonText = await lessonResponse.text();
            
            // 2. Construire le prompt pour l'IA
            const fullPrompt = createGenerationPrompt(questionType, lesson.name, lessonText);
            
            // 3. Appeler l'API
            const generatedContentJSON = await callGenerationAPI(fullPrompt);

            // 4. Mettre le contenu généré à jour
            if (questionType === 'qcm') {
                if (generatedContentJSON.questions && Array.isArray(generatedContentJSON.questions)) {
                    // L'IA génère ici un tableau d'UNE SEULE question QCM pour simplifier le flux
                    currentQuizData.push(generatedContentJSON.questions[0]); 
                } else {
                    console.warn("L'IA n'a pas renvoyé le format QCM attendu.");
                }
            } else if (questionType === 'paragraphe' || questionType === 'reponse_ouverte') {
                // On ajoute l'objet unique (paragraphe ou réponse ouverte)
                currentQuizData.push(generatedContentJSON);
            }

        } catch (error) {
            console.error(`Erreur lors du traitement de la leçon ${lesson.name}:`, error);
            document.getElementById('question-container').innerHTML = `
                <h2>❌ Erreur de Génération pour ${lesson.name}</h2>
                <p>Détails: ${error.message}</p>
                <button onclick="window.location.reload()">Retour au menu</button>`;
            isQuizRunning = false;
            return; 
        }
    }
    
    // Calcul du score total des QCM générés (c'est maintenant le total des points des questions générées)
    // Seules les QCM et Réponses Ouvertes ont des points pour le moment.
    totalQuizPoints = currentQuizData
        .filter(item => item.type === 'qcm' || item.type === 'reponse_ouverte')
        .reduce((sum, item) => sum + (item.points || 0), 0);
    
    currentQuizData.sort(() => Math.random() - 0.5);
    currentQuestionIndex = 0;
    displayCurrentQuestion();
    isQuizRunning = false; 
}


// --- Fonctions d'aide pour l'IA (Mise à jour pour les 3 types) ---

function createGenerationPrompt(type, lessonName, lessonText) {
    // Instruction de base commune pour le contexte
    const systemInstruction = `Vous êtes un générateur de quiz pour des élèves de 3ème. Générez une seule question basée UNIQUEMENT sur la leçon fournie ci-dessous. Le résultat doit être STRICTEMENT un objet JSON.`;

    // Leçons pour le contexte
    const lessonContext = `LEÇON FOURNIE (${lessonName}) : \n---\n${lessonText}\n---`;

    if (type === 'qcm') {
        // Pour simplifier le flux, on demande UNE seule question QCM pondérée.
        return `${systemInstruction}
        
        Générez UNE question à choix multiple (QCM). La question doit inclure un champ 'points' (ex: 3 ou 4) pour une difficulté sur un total théorique de 20 points si l'élève avait 5 questions.
        
        Le format JSON attendu est : 
        { "questions": [
            {"type": "qcm", "question": "...", "options": ["...", "...", "..."], "reponse_correcte": "...", "explication": "...", "points": 4 }
        ]}
        
        ${lessonContext}`;
        
    } else if (type === 'paragraphe') {
        // Similaire au paragraphe argumenté
        return `${systemInstruction}
        
        Générez UN sujet de paragraphe argumenté. Le format n'a pas besoin de points.
        
        Le format JSON attendu est : 
        { "type": "paragraphe_ia", "sujet": "...", "attendus": ["...", "..."], "consigne_ia": "Corrigez le texte de l'élève en 3e. Notez-le sur 10, en prenant en compte la clarté des arguments, la pertinence des exemples donnés et la structure de l'exposé." }
        
        ${lessonContext}`;
        
    } else if (type === 'reponse_ouverte') {
        // NOUVEAU : Question simple avec une réponse courte et des points
        return `${systemInstruction}
        
        Générez UNE question courte à réponse ouverte. La question doit inclure un champ 'points' (ex: 2 ou 3) pour une difficulté. Le champ 'reponse_attendue' doit contenir la réponse courte idéale.
        
        Le format JSON attendu est : 
        { "type": "reponse_ouverte", "question": "...", "points": 3, "reponse_attendue": "...", "consigne_ia": "Corrigez la réponse de l'élève. Vérifiez si sa réponse est similaire ou équivalente à la réponse attendue. Donnez une note sur 3 (pour le pointage) et une brève explication." }
        
        ${lessonContext}`;
    }
    return "Erreur: Type de contenu inconnu.";
}

// Fonction qui appelle la route /generation du serveur Render (inchangée)
async function callGenerationAPI(fullPrompt) {
    const response = await fetch(GENERATION_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_prompt: fullPrompt }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
        throw new Error(`Erreur API Render lors de la Génération: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.generated_content) {
        try {
            return JSON.parse(data.generated_content);
        } catch (e) {
            console.error("Erreur de parsing JSON de l'IA:", data.generated_content);
            throw new Error("L'IA n'a pas renvoyé un format JSON valide.");
        }
    } else {
        throw new Error("Réponse de génération incomplète: 'generated_content' manquant.");
    }
}


// --- Fonctions de rendu (Mise à jour pour les 3 types) ---

function displayCurrentQuestion() {
    const questionData = currentQuizData[currentQuestionIndex];
    const container = document.getElementById('question-container');
    
    let scoreDisplay = '';
    // On affiche le score si la question a des points (QCM ou Réponse Ouverte)
    if (totalQuizPoints > 0) {
        scoreDisplay = ` | Score: ${userScore} / ${totalQuizPoints} pts`;
    }
    
    container.innerHTML = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}${scoreDisplay}</h3>`;
    document.getElementById('next-question-btn').style.display = 'none';

    if (questionData.type === 'qcm') {
        container.innerHTML += renderQCM(questionData);
    } else if (questionData.type === 'paragraphe_ia') {
        container.innerHTML += renderParagraphe(questionData);
    } else if (questionData.type === 'reponse_ouverte') { // NOUVEAU
        container.innerHTML += renderReponseOuverte(questionData);
    }
}

function renderQCM(data) {
    const pointsDisplay = data.points ? `<p class="qcm-points">Cette question vaut **${data.points}** points.</p>` : '';
    
    let html = `<div class="qcm-question">
        ${pointsDisplay}
        <h4>${data.question}</h4>`;
    data.options.forEach((option, index) => {
        const id = `qcm-option-${index}`;
        html += `
            <input type="radio" id="${id}" name="qcm-answer" value="${option}">
            <label for="${id}">${option}</label><br>
        `;
    });
    html += `<button onclick="submitQCM()">Valider</button></div>`;
    return html;
}

function renderReponseOuverte(data) { // NOUVEAU
    const pointsDisplay = data.points ? `<p class="qcm-points">Cette question vaut **${data.points}** points.</p>` : '';
    
    let html = `<div class="reponse-ouverte-sujet">
        ${pointsDisplay}
        <h4>Question : ${data.question}</h4>
        <textarea id="ia-answer" rows="5" placeholder="Répondez brièvement ici (3-4 phrases maximum)..."></textarea>
        <button onclick="submitReponseOuverte()">Envoyer à l'IA pour correction</button></div>`;
    return html;
}

function renderParagraphe(data) {
    let html = `<div class="paragraphe-sujet"><h4>Sujet : ${data.sujet}</h4>`;
    html += `<textarea id="ia-answer" rows="10" placeholder="Rédigez votre paragraphe argumenté ici..."></textarea>`;
    html += `<button onclick="submitParagrapheIA()">Envoyer à l'IA pour correction</button></div>`;
    return html;
}


// --- Fonctions de soumission et de correction (Mise à jour pour les 3 types) ---

function submitQCM() {
    const questionData = currentQuizData[currentQuestionIndex];
    const resultDiv = document.getElementById('correction-feedback');
    const selectedOption = document.querySelector('input[name="qcm-answer"]:checked');

    if (!selectedOption) {
        alert("Veuillez sélectionner une réponse.");
        return;
    }

    const userAnswer = selectedOption.value;
    const isCorrect = userAnswer === questionData.reponse_correcte;
    const points = questionData.points || 0;

    if (isCorrect) {
        userScore += points; 
        
        resultDiv.innerHTML = `<p class="correct">✅ Correct! Vous gagnez **${points} points**.</p><p>${questionData.explication}</p>`;
    } else {
        resultDiv.innerHTML = `<p class="incorrect">❌ Faux. Vous ne gagnez aucun point.</p><p>La réponse correcte était: **${questionData.reponse_correcte}**.</p><p>Explication: ${questionData.explication}</p>`;
    }

    document.getElementById('next-question-btn').style.display = 'block';
}

async function submitReponseOuverte() { // NOUVEAU
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('ia-answer').value.trim();
    const resultDiv = document.getElementById('correction-feedback');

    if (userAnswer.length < 5) {
        alert("Veuillez écrire une réponse.");
        return;
    }
    
    resultDiv.innerHTML = '<p>Correction par l\'IA en cours... 🧠</p>';
    
    // Le prompt contient la consigne pour l'IA et la réponse de l'élève
    const prompt = `Consigne: ${questionData.consigne_ia}\n\nRéponse attendue: ${questionData.reponse_attendue}\n\nRéponse de l'élève à corriger:\n\n---\n${userAnswer}\n---`;
    
    try {
        const responseText = await callCorrectionAPI(prompt); 
        
        // On essaie de récupérer la note (le premier nombre dans la réponse)
        const noteMatch = responseText.match(/(\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)/);
        if (noteMatch) {
            const userPoints = parseFloat(noteMatch[1]);
            userScore += userPoints;
            
            resultDiv.innerHTML = `<div class="ia-feedback">${responseText}</div><p class="correct">Vous avez obtenu **${userPoints} points**.</p>`;
        } else {
             // Si pas de note trouvée (problème IA), on affiche le retour brut
            resultDiv.innerHTML = `<div class="ia-feedback">${responseText}</div><p class="warning">Score non déterminé. Vérifiez la réponse de l'IA.</p>`;
        }
        
        document.getElementById('next-question-btn').style.display = 'block';

    } catch (error) {
        console.error("Erreur lors de la correction:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA. Détails: ${error.message}</p>`;
    }
}


async function submitParagrapheIA() {
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('ia-answer').value.trim();
    const resultDiv = document.getElementById('correction-feedback');

    if (userAnswer.length < 50) {
        alert("Veuillez écrire un paragraphe plus long (minimum 50 caractères).");
        return;
    }
    
    resultDiv.innerHTML = '<p>Correction par l\'IA en cours... 🧠</p>';
    
    // Le prompt contient la consigne pour l'IA et la réponse de l'élève
    const prompt = `${questionData.consigne_ia}\n\nTexte de l'élève à corriger:\n\n---\n${userAnswer}\n---`;
    
    try {
        // Le paragraphe argumenté n'ajoute pas de score au compteur total.
        const responseText = await callCorrectionAPI(prompt); 
        
        resultDiv.innerHTML = `<div class="ia-feedback">${responseText}</div>`;
        document.getElementById('next-question-btn').style.display = 'block';

    } catch (error) {
        console.error("Erreur lors de la correction:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA. Détails: ${error.message}</p>`;
    }
}


// Fonction d'appel à la route /correction (inchangée)
async function callCorrectionAPI(prompt) {
    const response = await fetch(CORRECTION_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: prompt 
        }),
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
        throw new Error(`Erreur API Render lors de la Correction: ${errorData.error || response.statusText}`);
    }

    const data = await response.json(); 
    return data.correction_text;
}


// --- Navigation (inchangée) ---

function nextQuestion() {
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
        // FIN DU QUIZ : Affichage du score total
        let feedback = `<h2>🎉 Quiz terminé !</h2>`;
        
        // On ne calcule la note sur 20 que si des questions ont été notées.
        if (totalQuizPoints > 0) {
            // Note sur 20 calculée à partir du score obtenu / score total des questions générées
            const finalNote = (userScore / totalQuizPoints) * 20; 
            const finalNoteRounded = finalNote.toFixed(2);
            
            feedback += `<p>Votre performance globale est de **${userScore.toFixed(2)} / ${totalQuizPoints} points**.</p>`;
            feedback += `<h3>Votre note estimée sur 20 est : **${finalNoteRounded} / 20**</h3>`;
        } else {
             feedback += `<p>Ce quiz ne contenait que des sujets de rédaction (paragraphes) non notés sur ce barème.</p>`;
        }

        document.getElementById('question-container').innerHTML = feedback + '<button onclick="window.location.reload()">Recommencer</button>';
    }
}
