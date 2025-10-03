// script.js

console.log("script.js chargé."); // Log au chargement du script

const MATIERES_BASE_PATH = 'matieres';
let config = {};
let selectedItems = []; // Tableau pour stocker les chemins des fichiers JSON sélectionnés
let currentQuizData = []; // Données des questions pour le quiz actuel
let currentQuestionIndex = 0;

// URL de votre serveur proxy sécurisé sur Render (avec les NOUVELLES routes)
const BASE_API_URL = 'https://cle-api.onrender.com'; 
const CORRECTION_API_URL = `${BASE_API_URL}/correction`; 
const GENERATION_API_URL = `${BASE_API_URL}/generation`; // Nouvelle route non utilisée par défaut ici, mais prête.

console.log("BASE_API_URL:", BASE_API_URL);
console.log("CORRECTION_API_URL:", CORRECTION_API_URL);
console.log("GENERATION_API_URL:", GENERATION_API_URL);


// --- Gestion de la structure des matières (Simulée) ---

// Structure codée en dur, incluant l'Allemand
const STRUCTURE = {
    "Mathematiques": {
        "Nombres_Premiers": ["QCM_1.json"],
        "Les_Aires": ["QCM_Aires.json"]
    },
    "Histoire_Geo": {
        "La_Revolution_Francaise": ["Paragraphe_Argumente_1.json"],
        "Les_Fleuves_du_Monde": ["QCM_Geographie.json"]
    },
    // NOUVEAU : Ajout de la matière Allemand
    "Allemand": {
        "Vocabulaire_Facile": ["QCM_Vocabulaire_Facile.json"],
        "Grammaire_Base": ["QCM_Grammaire_Base.json"]
    }
};

// --- Initialisation et chargement des ressources ---

// Ton gestionnaire d'erreurs global
window.onerror = function(msg, url, line, col, error) {
    const debugElement = document.getElementById('debug');
    if (debugElement) {
        debugElement.textContent =
            "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
        console.error("Global JS Error:", msg, url, line, col, error);
    } else {
        console.error("Global JS Error (debug element not found):", msg, url, line, col, error);
    }
    return true; // Empêche l'erreur de se propager aux outils de développement (optionnel)
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content chargé. Initialisation...");

    fetch('config.json')
        .then(response => {
            console.log("Réponse de config.json reçue.");
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            config = data;
            console.log('Configuration chargée:', config);
            loadStructure();
        })
        .catch(error => {
            console.error("Erreur de chargement de config.json ou de parsing JSON:", error);
            loadStructure(); // Tente de charger la structure même sans config.json
        });

    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
    
    // NOUVEAU : Ajout des écouteurs pour les boutons de génération IA
    const generateQCMBtn = document.getElementById('generate-qcm-btn');
    const generateParagrapheBtn = document.getElementById('generate-paragraphe-btn');

    if (generateQCMBtn) {
        generateQCMBtn.addEventListener('click', () => generateContentFromAI('qcm'));
        console.log("Écouteur pour 'Générer QCM' attaché.");
    } else {
        console.warn("Bouton 'generate-qcm-btn' non trouvé.");
    }

    if (generateParagrapheBtn) {
        generateParagrapheBtn.addEventListener('click', () => generateContentFromAI('paragraphe_ia'));
        console.log("Écouteur pour 'Générer Paragraphe' attaché.");
    } else {
        console.warn("Bouton 'generate-paragraphe-btn' non trouvé.");
    }
    console.log("Écouteurs d'événements attachés.");
});


// --- Gestion de la structure des matières (Affichage) ---

function loadStructure() {
    console.log("Début du chargement de la structure des matières...");
    const menuContainer = document.getElementById('menu-container');
    if (!menuContainer) {
        console.error("Conteneur de menu (#menu-container) non trouvé.");
        return;
    }
    menuContainer.innerHTML = '';

    for (const matiere in STRUCTURE) {
        console.log("Ajout de la matière:", matiere);
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        matiereDiv.innerHTML = `<h2>${matiere}</h2>`;

        const chapitresList = document.createElement('ul');

        for (const chapitre in STRUCTURE[matiere]) {
            console.log("  Ajout du chapitre:", chapitre);
            const chapitreLi = document.createElement('li');
            chapitreLi.innerHTML = `<h3>${chapitre.replace(/_/g, ' ')}</h3>`; // Affiche le nom sans underscore

            const itemsList = document.createElement('ul');
            STRUCTURE[matiere][chapitre].forEach(item => {
                console.log("    Ajout de l'élément:", item);
                const itemLi = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                
                // Chemin complet du fichier
                const fullPath = `${MATIERES_BASE_PATH}/${matiere}/${chapitre}/${item}`;
                checkbox.value = fullPath;
                checkbox.id = fullPath;
                
                checkbox.addEventListener('change', updateSelection);

                const label = document.createElement('label');
                label.htmlFor = fullPath;
                label.textContent = item;

                itemLi.appendChild(checkbox);
                itemLi.appendChild(label);
                itemsList.appendChild(itemLi);
            });

            chapitreLi.appendChild(itemsList);
            chapitresList.appendChild(chapitreLi);
        }

        matiereDiv.appendChild(chapitresList);
        menuContainer.appendChild(matiereDiv);
    }
    console.log("Structure des matières chargée.");
}

function updateSelection(event) {
    const path = event.target.value;
    if (event.target.checked) {
        selectedItems.push(path);
        console.log("Sélection ajoutée:", path);
    } else {
        selectedItems = selectedItems.filter(item => item !== path);
        console.log("Sélection retirée:", path);
    }
    console.log("Éléments actuellement sélectionnés:", selectedItems);
    
    const selectionDisplay = document.getElementById('selected-items');
    if (selectionDisplay) {
        selectionDisplay.textContent = selectedItems.map(p => p.split('/').slice(-3).join(' > ')).join(' | ');
    } else {
        console.warn("Élément 'selected-items' non trouvé pour l'affichage de la sélection.");
    }
}

// --- Logique du Quiz/Paragraphe ---

async function startQuiz() {
    console.log("Démarrage de la fonction startQuiz.");
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins un chapitre/quiz à commencer !");
        console.warn("startQuiz annulé: aucun élément sélectionné.");
        return;
    }
    
    const selectionView = document.getElementById('selection-view');
    const quizView = document.getElementById('quiz-view');
    if (selectionView && quizView) {
        selectionView.style.display = 'none';
        quizView.style.display = 'block';
        console.log("Passage de la vue de sélection à la vue de quiz.");
    } else {
        console.error("Éléments 'selection-view' ou 'quiz-view' non trouvés.");
        return;
    }

    currentQuizData = [];
    
    for (const itemPath of selectedItems) {
        try {
            console.log("Chargement du fichier JSON:", itemPath);
            const response = await fetch(itemPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${itemPath}`);
            }
            let data = await response.json();
            console.log("Données chargées pour", itemPath, ":", data);
            
            if (Array.isArray(data)) {
                currentQuizData.push(...data);
            } else {
                currentQuizData.push(data);
            }
        } catch (error) {
            console.error(`Erreur de chargement ou de parsing JSON pour ${itemPath}:`, error);
        }
    }
    
    // Mélanger les questions
    currentQuizData.sort(() => Math.random() - 0.5);
    console.log("Questions chargées et mélangées. Total:", currentQuizData.length, "questions.");

    currentQuestionIndex = 0;
    displayCurrentQuestion();
    console.log("Quiz démarré avec la première question.");
}

function displayCurrentQuestion() {
    console.log("Affichage de la question actuelle. Index:", currentQuestionIndex, "/", currentQuizData.length);
    const questionContainer = document.getElementById('question-container');
    if (!questionContainer) {
        console.error("Conteneur de question (#question-container) non trouvé.");
        return;
    }
    
    const questionData = currentQuizData[currentQuestionIndex];

    if (!questionData) {
        console.log("Fin des questions disponibles. Affichage du message de fin.");
        questionContainer.innerHTML = `<h2>Bravo, vous avez terminé la révision !</h2>
            <button onclick="window.location.reload()">Recommencer</button>`;
        return;
    }
    
    let html = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}</h3>`;
    
    if (questionData.type === 'qcm') {
        console.log("Affichage d'un QCM:", questionData.question);
        html += `<div class="qcm-question"><h4>${questionData.question}</h4>`;
        
        questionData.options.forEach((option, index) => {
            html += `<label>
                        <input type="radio" name="qcm-answer" value="${option}" id="qcm-option-${index}">
                        ${option}
                    </label><br>`;
        });
        
        html += `<button onclick="submitQCM()">Valider</button></div>`;
        
    } else if (questionData.type === 'paragraphe_ia') {
        console.log("Affichage d'un sujet de paragraphe IA:", questionData.sujet);
        html += `<div class="paragraphe-sujet"><h4>Sujet : ${questionData.sujet}</h4>
                 <p>Attendus : ${questionData.attendus.join(', ')}</p>
                 <textarea id="ia-answer" rows="10" placeholder="Écrivez votre paragraphe argumenté ici..."></textarea>
                 <button onclick="submitParagrapheIA()">Envoyer à l'IA pour correction</button></div>`;
    } else {
        console.warn("Type de question inconnu:", questionData.type, "pour les données:", questionData);
        html += `<p class="error">Type de question inconnu. Impossible d'afficher.</p>`;
    }

    questionContainer.innerHTML = html;
    
    const correctionFeedbackDiv = document.getElementById('correction-feedback');
    if (correctionFeedbackDiv) {
        correctionFeedbackDiv.innerHTML = '';
    } else {
        console.warn("Élément 'correction-feedback' non trouvé.");
    }

    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.style.display = 'none';
    } else {
        console.warn("Bouton 'next-question-btn' non trouvé.");
    }
}

// --- Fonctions de Soumission et Correction ---

function submitQCM() {
    console.log("Soumission du QCM...");
    const questionData = currentQuizData[currentQuestionIndex];
    const selected = document.querySelector('input[name="qcm-answer"]:checked');
    const resultDiv = document.getElementById('correction-feedback');
    
    if (!selected) {
        alert("Veuillez sélectionner une réponse.");
        console.warn("Validation QCM annulée: aucune réponse sélectionnée.");
        return;
    }
    
    const userAnswer = selected.value;
    console.log("Réponse utilisateur QCM:", userAnswer);
    console.log("Réponse correcte attendue:", questionData.reponse_correcte);

    if (!resultDiv) {
        console.error("Élément 'correction-feedback' non trouvé.");
        return;
    }
    
    if (userAnswer === questionData.reponse_correcte) {
        resultDiv.innerHTML = '<p class="correct">✅ Bonne réponse !</p>';
        console.log("Réponse QCM correcte.");
    } else {
        let feedback = `<p class="incorrect">❌ Faux. La bonne réponse était : <strong>${questionData.reponse_correcte}</strong>.</p>`;
        if (questionData.explication) {
            feedback += `<p>Explication : ${questionData.explication}</p>`;
        }
        resultDiv.innerHTML = feedback;
        console.log("Réponse QCM incorrecte. Explication:", questionData.explication || "Aucune.");
    }

    const nextQuestionBtn = document.getElementById('next-question-btn');
    if (nextQuestionBtn) {
        nextQuestionBtn.style.display = 'block';
    }
}

// Fonction qui appelle votre proxy Render sécurisé sur la route /correction
async function callCorrectionAPI(prompt) {
    console.log("Appel à l'API de correction. Prompt envoyé (début):", prompt.substring(0, 200) + "...");
    try {
        const response = await fetch(CORRECTION_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: prompt // On envoie le prompt que votre serveur Render attend
            }),
        });
        console.log("Réponse de l'API de correction reçue. Statut:", response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
            console.error("Erreur brute de l'API de correction:", errorData);
            throw new Error(`Erreur API Render (${response.status}): ${errorData.error || response.statusText}`);
        }
        
        const data = await response.json();
        console.log("Données de l'API de correction parsées:", data);
        
        if (data.correction_text) {
            return data.correction_text;
        } else {
            console.error("Réponse de l'API incomplète ou mal formée pour la correction:", data);
            return "L'IA n'a pas pu générer de correction pour le moment. Réponse inattendue du serveur.";
        }
    } catch (error) {
        console.error("Erreur lors de l'appel réseau ou du parsing de l'API de correction:", error);
        throw error; // Rejette l'erreur pour qu'elle soit gérée plus haut
    }
}


async function submitParagrapheIA() {
    console.log("Soumission du paragraphe pour correction IA...");
    const questionData = currentQuizData[currentQuestionIndex];
    const userAnswer = document.getElementById('ia-answer')?.value.trim(); // Utilisation de l'opérateur optionnel chaining
    const resultDiv = document.getElementById('correction-feedback');

    if (!userAnswer || userAnswer.length < 50) {
        alert("Veuillez écrire un paragraphe plus long (minimum 50 caractères).");
        console.warn("Validation paragraphe annulée: texte trop court ou vide.");
        return;
    }
    if (!resultDiv) {
        console.error("Élément 'correction-feedback' non trouvé.");
        return;
    }
    
    resultDiv.innerHTML = '<p>Correction par l\'IA en cours... 🧠</p>';
    console.log("Paragraphe utilisateur soumis (début):", userAnswer.substring(0, 100) + "...");
    
    // Le prompt contient la consigne pour l'IA et la réponse de l'élève
    const prompt = `${questionData.consigne_ia}\n\nTexte de l'élève à corriger:\n\n---\n${userAnswer}\n---`;
    
    try {
        const responseText = await callCorrectionAPI(prompt); 
        console.log("Correction de l'IA reçue (début):", responseText.substring(0, 200) + "...");
        
        // On remplace les sauts de ligne (\n) par des balises <br> pour un meilleur affichage HTML
        const formattedText = responseText.replace(/\n/g, '<br>');
        
        resultDiv.innerHTML = `<div class="ia-feedback">${formattedText}</div>`;
        const nextQuestionBtn = document.getElementById('next-question-btn');
        if (nextQuestionBtn) {
            nextQuestionBtn.style.display = 'block';
        }
        console.log("Correction IA affichée.");

    } catch (error) {
        console.error("Erreur lors de la correction par l'IA:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA. Vérifiez votre service Render. Détails: ${error.message}</p>`;
    }
}

// NOUVELLE FONCTION : Appelle l'API de génération d'IA
async function generateContentFromAI(contentType) {
    console.log("Début de la génération de contenu par l'IA. Type demandé:", contentType);
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    if (!generationFeedbackDiv) {
        console.error("Élément 'ai-generation-feedback' non trouvé.");
        return;
    }
    generationFeedbackDiv.innerHTML = '<p>🧠 Demande à l\'IA de générer un ' + contentType.replace('_ia', '') + '...</p>';
    
    // Préparer le prompt pour l'IA.
    let promptText;
    if (contentType === 'qcm') {
        promptText = "Vous êtes un générateur de quiz pour des élèves de 3ème. Générez un QCM de niveau collège (3ème) sur un sujet aléatoire, avec 4 options de réponse et une explication pour la bonne réponse. Le QCM doit être au format JSON prêt à être utilisé par mon application. Répondez UNIQUEMENT avec l'objet JSON. Exemple de format : { \"type\": \"qcm\", \"question\": \"Quelle est la capitale de la France ?\", \"options\": [\"Berlin\",\"Madrid\",\"Paris\",\"Rome\"], \"reponse_correcte\": \"Paris\", \"explication\": \"Paris est la capitale et la plus grande ville de France.\" }";
    } else if (contentType === 'paragraphe_ia') {
        promptText = "Vous êtes un concepteur de sujets d'examen pour des élèves de 3ème. Générez un sujet de paragraphe argumenté de niveau collège (3ème) sur un thème aléatoire. Incluez 3 à 4 attendus pour ce paragraphe et une consigne spécifique pour la correction par l'IA. Répondez UNIQUEMENT avec l'objet JSON. Exemple de format : { \"type\": \"paragraphe_ia\", \"sujet\": \"La Révolution Française a-t-elle été un tournant majeur dans l'Histoire ?\", \"attendus\": [\"Introduction du contexte\",\"Arguments pour le 'tournant majeur'\",\"Arguments nuancés ou critiques\",\"Conclusion\"], \"consigne_ia\": \"Corrigez ce paragraphe argumenté d'un élève de 3ème. Donnez une note sur 10 et des commentaires constructifs sur l'argumentation, la structure et la maîtrise du sujet.\" }";
    } else {
        generationFeedbackDiv.innerHTML = '<p class="error">Type de contenu inconnu pour la génération IA.</p>';
        console.warn("Type de contenu IA inconnu:", contentType);
        return;
    }
    console.log("Prompt préparé pour l'API de génération (début):", promptText.substring(0, 200) + "...");

    try {
        const response = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: promptText // On envoie le prompt que votre serveur Render attend
            }),
        });
        console.log("Réponse de l'API de génération reçue. Statut:", response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
            console.error("Erreur brute de l'API de génération:", errorData);
            throw new Error(`Erreur API Render (${response.status}): ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        console.log("Données de l'API de génération parsées:", data);
        
        // Assurez-vous que l'IA renvoie un JSON analysable et utilisable
        if (data.generated_content) {
            console.log("Chaîne JSON générée par l'IA:", data.generated_content);
            const generatedQuestion = JSON.parse(data.generated_content); // L'IA doit renvoyer une chaîne JSON
            
            // On s'assure que le contenu généré correspond au type demandé
            if (generatedQuestion.type === contentType) {
                console.log("Contenu généré par l'IA parsé et validé:", generatedQuestion);
                currentQuizData = [generatedQuestion]; // Remplace les questions actuelles par celle générée
                selectedItems = []; // Réinitialise les éléments sélectionnés si tu ne veux pas les mélanger
                currentQuestionIndex = 0;
                
                const selectionView = document.getElementById('selection-view');
                const quizView = document.getElementById('quiz-view');
                if (selectionView && quizView) {
                    selectionView.style.display = 'none';
                    quizView.style.display = 'block';
                    generationFeedbackDiv.innerHTML = ''; // Nettoie le feedback
                    console.log("Vue basculée sur le quiz avec la question générée.");
                } else {
                    console.error("Éléments 'selection-view' ou 'quiz-view' non trouvés.");
                }
                displayCurrentQuestion(); // Affiche la question générée
            } else {
                 generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA a généré un type de contenu inattendu.</p>';
                 console.error("Le type de contenu généré par l'IA ne correspond pas au type demandé. Attendu:", contentType, "Reçu:", generatedQuestion.type);
            }
        } else {
            console.error("Réponse de l'API de génération incomplète ou mal formée: 'generated_content' manquant.", data);
            generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA n\'a pas pu générer le contenu. Réponse inattendue du serveur.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la génération par l'IA:", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA ou format de réponse invalide. Détails: ${error.message}</p>`;
    }
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
    displayCurrentQuestion();
}
