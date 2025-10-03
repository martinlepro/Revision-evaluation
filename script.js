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
