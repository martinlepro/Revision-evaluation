window.onerror = function(msg, url, line, col, error) {
  document.getElementById('debug').textContent =
    "Erreur JS : " + msg + "\nLigne: " + line + "\n" + (error ? error.stack : "");
};
const MATIERES_BASE_PATH = 'matieres';
let config = {};
let selectedItems = []; // Tableau pour stocker les chemins des fichiers JSON sélectionnés
let currentQuizData = []; // Données des questions pour le quiz actuel
let currentQuestionIndex = 0;

// URL de votre serveur proxy sécurisé sur Render (avec les NOUVELLES routes)
const BASE_API_URL = 'https://cle-api.onrender.com'; 
const CORRECTION_API_URL = `${BASE_API_URL}/correction`; 
const GENERATION_API_URL = `${BASE_API_URL}/generation`; // Nouvelle route non utilisée par défaut ici, mais prête.


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

document.addEventListener('DOMContentLoaded', () => {
    fetch('config.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            console.log('Configuration chargée.');
            loadStructure();
        })
        .catch(error => {
            console.error("Erreur de chargement de config.json.", error);
            loadStructure();
        });

    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
    // ... (ton code existant) ...

document.addEventListener('DOMContentLoaded', () => {
    fetch('config.json')
        .then(response => response.json())
        .then(data => {
            config = data;
            console.log('Configuration chargée.');
            loadStructure();
        })
        .catch(error => {
            console.error("Erreur de chargement de config.json.", error);
            loadStructure();
        });

    document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
    
    // NOUVEAU : Ajout des écouteurs pour les boutons de génération IA
    document.getElementById('generate-qcm-btn').addEventListener('click', () => generateContentFromAI('qcm'));
    document.getElementById('generate-paragraphe-btn').addEventListener('click', () => generateContentFromAI('paragraphe_ia'));
});
// NOUVELLE FONCTION : Appelle l'API de génération d'IA
async function generateContentFromAI(contentType) {
    const generationFeedbackDiv = document.getElementById('ai-generation-feedback');
    generationFeedbackDiv.innerHTML = '<p>🧠 Demande à l\'IA de générer un ' + contentType.replace('_ia', '') + '...</p>';
    
    // Préparer le prompt pour l'IA. C'est ici que tu demandes un sujet "aléatoire".
    let promptText;
    if (contentType === 'qcm') {
        promptText = "Génère un QCM de niveau collège (3ème) sur un sujet aléatoire, avec 4 options de réponse et une explication pour la bonne réponse. Le QCM doit être au format JSON prêt à être utilisé par mon application. Exemple de format : { \"type\": \"qcm\", \"question\": \"...\", \"options\": [\"A\",\"B\",\"C\",\"D\"], \"reponse_correcte\": \"...\", \"explication\": \"...\" }";
    } else if (contentType === 'paragraphe_ia') {
        promptText = "Génère un sujet de paragraphe argumenté de niveau collège (3ème) sur un thème aléatoire. Inclue 3 à 4 attendus pour ce paragraphe et une consigne spécifique pour la correction par l'IA. Le tout doit être au format JSON. Exemple de format : { \"type\": \"paragraphe_ia\", \"sujet\": \"...\", \"attendus\": [\"...\",\"...\"], \"consigne_ia\": \"...\" }";
    } else {
        generationFeedbackDiv.innerHTML = '<p class="error">Type de contenu inconnu pour la génération IA.</p>';
        return;
    }

    try {
        const response = await fetch(GENERATION_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: promptText 
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
            throw new Error(`Erreur API Render: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        
        // Assurez-vous que l'IA renvoie un JSON analysable et utilisable
        if (data.generated_content) {
            const generatedQuestion = JSON.parse(data.generated_content); // L'IA doit renvoyer une chaîne JSON
            
            // On s'assure que le contenu généré correspond au type demandé
            if (generatedQuestion.type === contentType) {
                currentQuizData = [generatedQuestion]; // Remplace les questions actuelles par celle générée
                selectedItems = []; // Réinitialise les éléments sélectionnés si tu ne veux pas les mélanger
                currentQuestionIndex = 0;
                
                document.getElementById('selection-view').style.display = 'none';
                document.getElementById('quiz-view').style.display = 'block';
                generationFeedbackDiv.innerHTML = ''; // Nettoie le feedback
                displayCurrentQuestion(); // Affiche la question générée
            } else {
                 generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA a généré un type de contenu inattendu.</p>';
            }
        } else {
            console.error("Réponse de l'API incomplète ou mal formée:", data);
            generationFeedbackDiv.innerHTML = '<p class="error">❌ L\'IA n\'a pas pu générer le contenu. Réponse inattendue du serveur.</p>';
        }

    } catch (error) {
        console.error("Erreur lors de la génération par l'IA:", error);
        generationFeedbackDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA ou format de réponse invalide. Détails: ${error.message}</p>`;
    }
}


});

// --- Gestion de la structure des matières (Affichage) ---

function loadStructure() {
    const menuContainer = document.getElementById('menu-container');
    menuContainer.innerHTML = '';

    for (const matiere in STRUCTURE) {
        const matiereDiv = document.createElement('div');
        matiereDiv.className = 'matiere';
        matiereDiv.innerHTML = `<h2>${matiere}</h2>`;

        const chapitresList = document.createElement('ul');

        for (const chapitre in STRUCTURE[matiere]) {
            const chapitreLi = document.createElement('li');
            chapitreLi.innerHTML = `<h3>${chapitre.replace(/_/g, ' ')}</h3>`; // Affiche le nom sans underscore

            const itemsList = document.createElement('ul');
            STRUCTURE[matiere][chapitre].forEach(item => {
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
}

function updateSelection(event) {
    const path = event.target.value;
    if (event.target.checked) {
        selectedItems.push(path);
    } else {
        selectedItems = selectedItems.filter(item => item !== path);
    }
    
    const selectionDisplay = document.getElementById('selected-items');
    selectionDisplay.textContent = selectedItems.map(p => p.split('/').slice(-3).join(' > ')).join(' | ');
}

// --- Logique du Quiz/Paragraphe ---

async function startQuiz() {
    if (selectedItems.length === 0) {
        alert("Veuillez sélectionner au moins un chapitre/quiz à commencer !");
        return;
    }
    
    document.getElementById('selection-view').style.display = 'none';
    document.getElementById('quiz-view').style.display = 'block';

    currentQuizData = [];
    
    for (const itemPath of selectedItems) {
        try {
            const response = await fetch(itemPath);
            let data = await response.json();
            
            if (Array.isArray(data)) {
                currentQuizData.push(...data);
            } else {
                currentQuizData.push(data);
            }
        } catch (error) {
            console.error(`Erreur de chargement du fichier ${itemPath}:`, error);
        }
    }
    
    currentQuizData.sort(() => Math.random() - 0.5);

    currentQuestionIndex = 0;
    displayCurrentQuestion();
}

function displayCurrentQuestion() {
    const questionContainer = document.getElementById('question-container');
    const questionData = currentQuizData[currentQuestionIndex];

    if (!questionData) {
        questionContainer.innerHTML = `<h2>Bravo, vous avez terminé la révision !</h2>
            <button onclick="window.location.reload()">Recommencer</button>`;
        return;
    }
    
    let html = `<h3>Question ${currentQuestionIndex + 1} / ${currentQuizData.length}</h3>`;
    
    if (questionData.type === 'qcm') {
        html += `<div class="qcm-question"><h4>${questionData.question}</h4>`;
        
        questionData.options.forEach((option) => {
            // Utiliser un ID unique basé sur l'option pour l'accessibilité si nécessaire, mais le name suffit pour le groupe
            html += `<label>
                        <input type="radio" name="qcm-answer" value="${option}">
                        ${option}
                    </label><br>`;
        });
        
        html += `<button onclick="submitQCM()">Valider</button></div>`;
        
    } else if (questionData.type === 'paragraphe_ia') {
        html += `<div class="paragraphe-sujet"><h4>Sujet : ${questionData.sujet}</h4>
                 <p>Attendus : ${questionData.attendus.join(', ')}</p>
                 <textarea id="ia-answer" rows="10" placeholder="Écrivez votre paragraphe argumenté ici..."></textarea>
                 <button onclick="submitParagrapheIA()">Envoyer à l'IA pour correction</button></div>`;
    }

    questionContainer.innerHTML = html;
    document.getElementById('correction-feedback').innerHTML = '';
    document.getElementById('next-question-btn').style.display = 'none';
}

// --- Fonctions de Soumission et Correction ---

function submitQCM() {
    const questionData = currentQuizData[currentQuestionIndex];
    const selected = document.querySelector('input[name="qcm-answer"]:checked');
    const resultDiv = document.getElementById('correction-feedback');
    
    if (!selected) {
        alert("Veuillez sélectionner une réponse.");
        return;
    }
    
    const userAnswer = selected.value;
    
    if (userAnswer === questionData.reponse_correcte) {
        resultDiv.innerHTML = '<p class="correct">✅ Bonne réponse !</p>';
    } else {
        let feedback = `<p class="incorrect">❌ Faux. La bonne réponse était : <strong>${questionData.reponse_correcte}</strong>.</p>`;
        if (questionData.explication) {
            feedback += `<p>Explication : ${questionData.explication}</p>`;
        }
        resultDiv.innerHTML = feedback;
    }

    document.getElementById('next-question-btn').style.display = 'block';
}

// Fonction qui appelle votre proxy Render sécurisé sur la route /correction
async function callCorrectionAPI(prompt) {
    const response = await fetch(CORRECTION_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: prompt // On envoie le prompt que votre serveur Render attend
        }),
    });
    
    if (!response.ok) {
        // Tenter de lire le message d'erreur du serveur
        const errorData = await response.json().catch(() => ({error: 'Réponse serveur non-JSON ou vide.'}));
        throw new Error(`Erreur API Render: ${errorData.error || response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.correction_text) {
        return data.correction_text;
    } else {
        console.error("Réponse de l'API incomplète:", data);
        return "L'IA n'a pas pu générer de correction pour le moment. Réponse inattendue du serveur.";
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
        const responseText = await callCorrectionAPI(prompt); 
        
        // On remplace les sauts de ligne (\n) par des balises <br> pour un meilleur affichage HTML
        const formattedText = responseText.replace(/\n/g, '<br>');
        
        resultDiv.innerHTML = `<div class="ia-feedback">${formattedText}</div>`;
        document.getElementById('next-question-btn').style.display = 'block';

    } catch (error) {
        console.error("Erreur lors de la correction:", error);
        resultDiv.innerHTML = `<p class="error">❌ Erreur de connexion à l'IA. Vérifiez votre service Render. Détails: ${error.message}</p>`;
    }
}

// --- Navigation ---

function nextQuestion() {
    document.getElementById('correction-feedback').innerHTML = '';
    document.getElementById('next-question-btn').style.display = 'none';

    currentQuestionIndex++;
    displayCurrentQuestion();
}
