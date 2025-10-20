document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando aplicação com Google Cloud TTS (Premium - Algieba)'); 

    // --- COLE A SUA CHAVE DE API DO GOOGLE CLOUD AQUI ---
    const SUA_CHAVE_API_GOOGLE = 'AIzaSyCZncgfC5xGjvezIUled31DKe4xnqVDKDs'; 
    // --- VOZ MASCULINA PREMIUM (ALTO CUSTO/QUALIDADE) ---
    const NOME_DA_VOZ = 'pt-BR-Chirp3-HD-Algieba'; 
    // --- CONTROLE DE VELOCIDADE ---
    let taxaDeFala = 1.0; 
    
    const cabecalho = document.querySelector('header');
    const livroSelect = document.getElementById('livro-select');
    const capituloSelect = document.getElementById('capitulo-select');
    const areaLeitura = document.getElementById('leitura');

    let indiceVersiculoAtual = 0;
    let versiculosDoCapituloElementos = []; 
    let dadosVersiculosAtuais = [];       
    let estadoLeitura = 'parado'; 
    let audioAtual = null; 

    // 1. VERIFICAÇÃO DE DADOS (CRÍTICA)
    if (typeof bibliaData === 'undefined') {
        console.error('Erro crítico: bibliaData não está definido.');
        areaLeitura.innerHTML = `<p class="aviso" style="color:red; font-weight:bold; padding:20px;">ERRO: Não foi possível carregar os dados da Bíblia. Verifique a sintaxe do arquivo biblia.js.</p>`;
        return; 
    } else {
        console.log('bibliaData carregado com sucesso');
    }
    
    const todosOsLivros = [...bibliaData.antigoTestamento, ...bibliaData.novoTestamento];
    console.log(`Total de livros carregados: ${todosOsLivros.length}`);

    // Eventos principais
    livroSelect.addEventListener('change', popularCapitulos);
    capituloSelect.addEventListener('change', exibirCapitulo);
    areaLeitura.addEventListener('click', iniciarLeituraDePontoEspecifico);

    function iniciarLeituraDePontoEspecifico(event) {
        const versiculoClicado = event.target.closest('.versiculo');
        if (!versiculoClicado) return;
        const novoIndice = Array.from(versiculosDoCapituloElementos).indexOf(versiculoClicado);
        console.log(`Clique detectado no versículo índice: ${novoIndice}`);
        if (novoIndice !== -1) {
            pararLeitura(false); 
            indiceVersiculoAtual = novoIndice; 
            estadoLeitura = 'tocando'; 
             const btn = document.getElementById('play-pause-btn');
             if(btn) btn.innerHTML = '⏸️'; 
            console.log(`Iniciando leitura a partir do índice ${indiceVersiculoAtual}`);
            lerProximoVersiculo(); 
        }
    }
    
    function popularLivros() {
        console.log("Populando lista de livros");
        livroSelect.innerHTML = '<option value="">Selecione um Livro</option>'; 
        todosOsLivros.forEach(livro => {
            const option = document.createElement('option');
            option.value = livro.nome;
            option.textContent = livro.nome;
            livroSelect.appendChild(option);
        });
        popularCapitulos(); 
    }
    function popularCapitulos() {
        const nomeLivroSelecionado = livroSelect.value;
        console.log(`Livro selecionado: ${nomeLivroSelecionado}`);
        capituloSelect.innerHTML = ''; 
        const livro = todosOsLivros.find(l => l.nome === nomeLivroSelecionado);
        if (livro && livro.capitulos) {
            console.log(`Carregando ${livro.capitulos.length} capítulos para ${nomeLivroSelecionado}`);
            livro.capitulos.forEach(cap => {
                const option = document.createElement('option');
                option.value = cap.capitulo;
                option.textContent = `Capítulo ${cap.capitulo}`;
                capituloSelect.appendChild(option);
            });
        } else if(nomeLivroSelecionado){ 
            console.warn(`Nenhum capítulo encontrado para ${nomeLivroSelecionado}`);
        }
        exibirCapitulo(); 
    }
    function exibirCapitulo() {
        console.log("Exibindo capítulo");
        pararLeitura(true); 
        
        areaLeitura.innerHTML = ''; 
        versiculosDoCapituloElementos = [];
        dadosVersiculosAtuais = [];
        const painelControleAntigo = document.getElementById('player-container');
        if (painelControleAntigo) painelControleAntigo.remove();

        if (!livroSelect.value || !capituloSelect.value) {
             console.log("Seleção de livro ou capítulo inválida para exibição.");
             areaLeitura.innerHTML = '<p class="aviso">Selecione um livro e capítulo para começar a leitura.</p>'; 
             return; 
        }

        const nomeLivro = livroSelect.value;
        const numeroCapitulo = parseInt(capituloSelect.value);
         console.log(`Carregando ${nomeLivro} capítulo ${numeroCapitulo}`);

        const livro = todosOsLivros.find(l => l.nome === nomeLivro);
        const capitulo = livro ? livro.capitulos.find(c => c.capitulo === numeroCapitulo) : null;
        
        const playerHtml = `<div id="player-container" class="player-controls"><button id="play-pause-btn" class="player-button" title="Tocar / Pausar">▶️</button><button id="stop-btn" class="player-button" title="Parar">⏹️</button></div>`;
        cabecalho.insertAdjacentHTML('beforeend', playerHtml);
        document.getElementById('play-pause-btn').addEventListener('click', tocarPausarLeitura);
        document.getElementById('stop-btn').addEventListener('click', () => pararLeitura(true)); 
        
        if (capitulo && capitulo.versiculos) {
             console.log(`Capítulo possui ${capitulo.versiculos.length} versículos`);
            dadosVersiculosAtuais = capitulo.versiculos; 
            
            capitulo.versiculos.forEach(v => {
                const p = document.createElement('p');
                p.className = 'versiculo';
                p.innerHTML = `<span class="numero-versiculo">${v.versiculo}</span><span class="texto-versiculo">${v.texto}</span>`;
                areaLeitura.appendChild(p);
            });
            versiculosDoCapituloElementos = areaLeitura.querySelectorAll('.versiculo'); 
        } else {
             console.warn(`Versículos não encontrados para ${nomeLivro} ${numeroCapitulo}`);
            areaLeitura.insertAdjacentHTML('beforeend', '<p class="aviso">Capítulo não encontrado ou sem versículos.</p>');
        }
    }
    
    function tocarPausarLeitura() {
        const btn = document.getElementById('play-pause-btn');
        if (!btn) { console.error("Botão Play/Pause não encontrado!"); return; } 

        if (estadoLeitura === 'tocando') {
            console.log("Pausando leitura");
            pausarLeitura();
        } else { // Se estava 'parado' ou 'pausado'
             console.log("Iniciando/Retomando leitura");
             estadoLeitura = 'tocando'; 
             btn.innerHTML = '⏸️';
            
            if (audioAtual && audioAtual.paused) {
                 console.log("Retomando áudio pausado");
                audioAtual.play();
                if (versiculosDoCapituloElementos[indiceVersiculoAtual]) {
                    versiculosDoCapituloElementos[indiceVersiculoAtual].classList.add('lendo-agora');
                }
            } else {
                 console.log("Iniciando ciclo 'lerProximoVersiculo' a partir do índice:", indiceVersiculoAtual);
                lerProximoVersiculo();
            }
        }
    }
    
    function pausarLeitura() {
         console.log("Função pausarLeitura chamada");
         estadoLeitura = 'pausado'; 
        if (audioAtual) {
             console.log("Pausando audioAtual");
             audioAtual.pause();
        }
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️';
        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) {
            versiculoLendo.classList.remove('lendo-agora');
        }
    }

    function pararLeitura(resetarIndice = false) {
         console.log(`Parando leitura, resetarIndice: ${resetarIndice}, estado ANTES: ${estadoLeitura}`);
         estadoLeitura = 'parado'; 

         if (audioAtual) {
             console.log("Parando e limpando audioAtual existente.");
             audioAtual.onended = null; 
             audioAtual.onerror = null;
             audioAtual.pause();
             audioAtual.src = ''; 
             audioAtual = null; 
         } else {
              console.log("Nenhum audioAtual para parar.");
         }

        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) {
            versiculoLendo.classList.remove('lendo-agora');
        }

        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️'; 

        if(resetarIndice){
            console.log("Resetando indiceVersiculoAtual para 0");
            indiceVersiculoAtual = 0; 
        }
         console.log(`Parada concluída, estado FINAL: ${estadoLeitura}, indice: ${indiceVersiculoAtual}`);
    }

    // --- FUNÇÃO DE AVANÇO (LÓGICA CENTRAL CORRIGIDA) ---
    async function lerProximoVersiculo() {
         if (estadoLeitura !== 'tocando') {
             console.log(`lerProximoVersiculo: Estado não é 'tocando' (${estadoLeitura}). Interrompendo ciclo.`);
             return; 
         }
        
         console.log(`lerProximoVersiculo: Iniciando índice ${indiceVersiculoAtual}`);

        if (indiceVersiculoAtual > 0 && versiculosDoCapituloElementos[indiceVersiculoAtual - 1]) {
             versiculosDoCapituloElementos[indiceVersiculoAtual - 1].classList.remove('lendo-agora');
        }

        if (indiceVersiculoAtual >= dadosVersiculosAtuais.length) {
             console.log("Fim do capítulo atingido. Parando leitura.");
            pararLeitura(true); 
            return;
        }

        const versiculoElementoAtual = versiculosDoCapituloElementos[indiceVersiculoAtual];
        const dadosVersiculo = dadosVersiculosAtuais[indiceVersiculoAtual];
        if (!dadosVersiculo || typeof dadosVersiculo.texto === 'undefined') {
             console.error(`Erro: Dados inválidos para o índice ${indiceVersiculoAtual}. Parando.`);
             pararLeitura(true);
             return;
        }
        const textoParaLer = dadosVersiculo.texto; 

        if(versiculoElementoAtual) { 
            versiculoElementoAtual.classList.add('lendo-agora'); 
            versiculoElementoAtual.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
        }

        try {
            // Define o callback que será chamado QUANDO o áudio terminar
            const onAudioEndCallback = () => {
                 console.log(`onAudioEndCallback: Áudio do índice ${indiceVersiculoAtual} terminou. Estado atual: ${estadoLeitura}`);
                 if (estadoLeitura === 'tocando') {
                    indiceVersiculoAtual++; 
                    lerProximoVersiculo(); 
                 } else {
                     console.log(`onAudioEndCallback: Estado mudou para ${estadoLeitura}. Interrompendo ciclo.`);
                 }
             };

            // Toca o áudio e passa o callback
             console.log(`Iniciando tocarAudio (Google TTS) para índice ${indiceVersiculoAtual}`);
            await tocarAudio(textoParaLer, onAudioEndCallback); 

        } catch (error) {
            console.error(`Erro no ciclo lerProximoVersiculo (índice ${indiceVersiculoAtual}):`, error);
        }
    }
    // --- FIM DA FUNÇÃO DE AVANÇO ---


    // --- FUNÇÃO TOCAR ÁUDIO (GOOGLE CLOUD TTS) ---
    async function tocarAudio(texto, onEndedCallback) { // Aceita o callback
        if (!SUA_CHAVE_API_GOOGLE || SUA_CHAVE_API_GOOGLE === 'COLE_AQUI_A_CHAVE_API_DO_GOOGLE') {
            alert('Por favor, configure sua chave de API do Google Cloud no arquivo script.js');
            pararLeitura(true);
            throw new Error("API Keys not set"); 
        }
        
        const googleTtsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${SUA_CHAVE_API_GOOGLE}`;

        try {
            console.log("Chamando API do Google Cloud...");
            const response = await fetch(googleTtsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: texto },
                    // USANDO A VOZ PREMIUM SELECIONADA: Chirp3-HD-Algieba (Masculina)
                    voice: { languageCode: 'pt-BR', name: NOME_DA_VOZ }, 
                    audioConfig: { 
                        audioEncoding: 'MP3',
                        speakingRate: taxaDeFala // AQUI ESTÁ O NOVO CONTROLE
                    }
                })
            });
             console.log(`Resposta da API: ${response.status}`);

            if (response.ok) {
                const data = await response.json();
                if (!data.audioContent) {
                    throw new Error("Resposta da API inválida: sem conteúdo de áudio.");
                }
                const audioBlob = b64toBlob(data.audioContent, 'audio/mp3'); // Converte base64 para Blob
                const audioUrl = URL.createObjectURL(audioBlob); 
                console.log(`audioUrl criado: ${audioUrl}`);

                // Limpa o áudio anterior de forma segura
                 if (audioAtual) {
                     console.log("Limpando áudio anterior existente.");
                     audioAtual.pause();
                     audioAtual.onended = null;
                     audioAtual.onerror = null;
                     audioAtual.src = '';
                     audioAtual = null;
                 }
                
                audioAtual = new Audio(audioUrl); 
                console.log("Novo audioAtual criado:", audioAtual);

                // --- PONTO CRÍTICO: ADICIONANDO LISTENERS DE FORMA SEGURA ---
                const handleEnded = () => {
                     console.log(`Evento 'ended' disparado para índice ${indiceVersiculoAtual}. Estado: ${estadoLeitura}`);
                     audioAtual.removeEventListener('ended', handleEnded); 
                     audioAtual.removeEventListener('error', handleError); 
                     URL.revokeObjectURL(audioUrl); 
                     if (onEndedCallback) {
                        onEndedCallback(); // CHAMA O CALLBACK QUE AVANÇA
                     }
                };
                audioAtual.addEventListener('ended', handleEnded);
                
                const handleError = (e) => {
                     console.error("Audio playback error event:", e);
                     audioAtual.removeEventListener('ended', handleEnded); 
                     audioAtual.removeEventListener('error', handleError); 
                     URL.revokeObjectURL(audioUrl);
                     alert("Erro ao tocar o áudio. Verifique a conexão ou o console.");
                     pararLeitura(true); 
                };
                audioAtual.addEventListener('error', handleError);
                // --- FIM DO PONTO CRÍTICO ---
                
                console.log("Iniciando playback do audioAtual");
                 try {
                     await audioAtual.play();
                     console.log("Playback iniciado com sucesso.");
                 } catch (playError) {
                     console.error("Erro ao tentar dar play no áudio:", playError);
                     alert("Não foi possível iniciar o áudio automaticamente. Clique em Play novamente ou verifique as permissões do navegador.");
                     pararLeitura(false); 
                     throw playError; 
                 }
                
            } else { 
                const errorText = await response.text();
                console.error('Erro na API do Google Cloud:', errorText);
                alert('Erro na API do Google Cloud: ' + errorText);
                pararLeitura(true);
                throw new Error("API Error"); 
            }
        } catch (error) { 
            console.error('Erro geral na função tocarAudio:', error);
            if (estadoLeitura !== 'parado') { 
                 pararLeitura(true); 
            }
            throw error; 
        }
    }
    // --- FIM DA FUNÇÃO TOCAR ÁUDIO ---
    
    // Função auxiliar para converter Base64 para Blob (necessário para o Google TTS)
    function b64toBlob(b64Data, contentType='') {
        const sliceSize = 512;
        const byteCharacters = atob(b64Data);
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);

            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }

            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        return new Blob(byteArrays, {type: contentType});
    }

   // --- CONEXÃO DO SLIDER DE VELOCIDADE (AJUSTADO PARA 0.05) ---
    const taxaFalaInput = document.getElementById('taxa-fala');
    const taxaFalaLabel = document.querySelector('.velocidade-control label');

    taxaFalaInput.addEventListener('input', (event) => {
        // Garante que o valor seja lido com precisão
        taxaDeFala = parseFloat(event.target.value); 
        // Atualiza o label para mostrar 2 casas decimais (1.00x)
        taxaFalaLabel.textContent = `Velocidade (${taxaDeFala.toFixed(2)}x)`; 
        console.log(`Velocidade de fala ajustada para: ${taxaDeFala}x`);
        
        // Se a leitura estiver ativa, pare e comece de novo com a nova velocidade
        if (estadoLeitura === 'tocando' || estadoLeitura === 'pausado') {
             const indiceDeRetomada = indiceVersiculoAtual;
             pararLeitura(false); // Para o áudio, não reseta o índice
             indiceVersiculoAtual = indiceDeRetomada;
             
             // Reinicia o ciclo (chama o play)
             estadoLeitura = 'tocando';
             document.getElementById('play-pause-btn').innerHTML = '⏸️';
             lerProximoVersiculo(); 
        }
        // Se o áudio estava parado, não faz nada além de atualizar a variável
    });
    // --- FIM DA CONEXÃO DO SLIDER ---

    // Inicia o processo carregando a lista de livros
    popularLivros();
});