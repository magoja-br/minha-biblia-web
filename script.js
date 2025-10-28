document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, iniciando aplicação com Google Cloud TTS');

    // --- CHAVE DE API (REMOVIDA/COMENTADA) ---
    // const apiKey = "chave"; 
    // --- VOZ E VELOCIDADE ---
    const NOME_DA_VOZ = 'pt-BR-Chirp3-HD-Algieba'; 
    let taxaDeFala = 1.0; 

    const cabecalho = document.querySelector('header');
    const livroSelect = document.getElementById('livro-select');
    const capituloSelect = document.getElementById('capitulo-select');
    const areaLeitura = document.getElementById('leitura');

    // --- Variáveis de Estado ---
    let indiceVersiculoAtual = 0;
    let versiculosDoCapituloElementos = []; 
    let dadosVersiculosAtuais = []; 
    let estadoLeitura = 'parado'; 
    let audioAtual = null; 
    let audioAtualUrl = null; // Guarda o URL (Data URL) do audioAtual
    let timeoutLimpezaAudio = null; 
    let abortController = null; 
    let isAudioPlaying = false; 
    let isProcessingAudio = false; 

    // Cache de áudio (usará Data URL)
    const audioCache = new Map();

    // 1. VERIFICAÇÃO DE DADOS (CRÍTICA)
    if (typeof bibliaData === 'undefined') {
        console.error('Erro crítico: bibliaData não está definido.');
        areaLeitura.innerHTML = `<p class="aviso" style="color:red; font-weight:bold; padding:20px;">ERRO: Não foi possível carregar os dados da Bíblia.</p>`;
        return;
    } else {
        console.log('bibliaData carregado com sucesso');
    }

    const todosOsLivros = [...bibliaData.antigoTestamento, ...bibliaData.novoTestamento];
    console.log(`Total de livros carregados: ${todosOsLivros.length}`);

    // --- Eventos principais ---
    livroSelect.addEventListener('change', popularCapitulos);
    capituloSelect.addEventListener('change', exibirCapitulo);
    areaLeitura.addEventListener('click', iniciarLeituraDePontoEspecifico);

    // Limpeza ao fechar a janela
    window.addEventListener('beforeunload', () => {
        pararLeitura(true); 
    });

    // Iniciar leitura ao clicar num versículo
    function iniciarLeituraDePontoEspecifico(event) {
        if (isProcessingAudio) return; 
        const versiculoClicado = event.target.closest('.versiculo');
        if (!versiculoClicado || !versiculosDoCapituloElementos.length) return;

        const novoIndice = Array.from(versiculosDoCapituloElementos).indexOf(versiculoClicado);
        console.log(`Clique detectado no versículo índice: ${novoIndice}`);
        if (novoIndice !== -1) {
            pararLeitura(false); 
            indiceVersiculoAtual = novoIndice; 

            estadoLeitura = 'tocando';
            const btn = document.getElementById('play-pause-btn');
            if(btn) btn.innerHTML = '⏸️';
            console.log(`Iniciando leitura a partir do índice ${indiceVersiculoAtual}`);
            setTimeout(() => lerProximoVersiculo(), 50);
        }
    }

    // Popular lista de livros no <select>
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

    // Popular lista de capítulos baseado no livro selecionado
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

    // Exibe os versículos do capítulo selecionado
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

        // Cria o painel de controle
        if(capitulo && capitulo.versiculos && capitulo.versiculos.length > 0){
            const playerHtml = `<div id="player-container" class="player-controls"><button id="play-pause-btn" class="player-button" title="Tocar / Pausar">▶️</button><button id="stop-btn" class="player-button" title="Parar">⏹️</button></div>`;
            const navElement = cabecalho.querySelector('nav');
            if(navElement) navElement.insertAdjacentHTML('afterend', playerHtml);
            else cabecalho.insertAdjacentHTML('beforeend', playerHtml);

            // Adiciona listeners aos botões (usando debounce)
            // *** CORREÇÃO: Usa debounce aqui ***
            document.getElementById('play-pause-btn').addEventListener('click', debounce(tocarPausarLeitura, 200));
            document.getElementById('stop-btn').addEventListener('click', debounce(() => pararLeitura(true), 200));
            console.log("Painel de controle adicionado.");
        } else {
             console.log("Capítulo sem versículos, painel de controle não será adicionado.");
        }


        if (capitulo && capitulo.versiculos && capitulo.versiculos.length > 0) {
            console.log(`Capítulo possui ${capitulo.versiculos.length} versículos`);
            dadosVersiculosAtuais = capitulo.versiculos; 

            capitulo.versiculos.forEach((v, index) => { 
                const p = document.createElement('p');
                p.className = 'versiculo';
                p.dataset.index = index; 
                p.innerHTML = `<span class="numero-versiculo">${v.versiculo}</span><span class="texto-versiculo">${v.texto}</span>`;
                areaLeitura.appendChild(p);
            });
            versiculosDoCapituloElementos = areaLeitura.querySelectorAll('.versiculo'); 
        } else {
            console.warn(`Versículos não encontrados para ${nomeLivro} ${numeroCapitulo}`);
            areaLeitura.insertAdjacentHTML('beforeend', '<p class="aviso">Capítulo não encontrado ou sem versículos.</p>');
        }
    }
    
    // Adiciona/Remove classe CSS para destacar o versículo atual e faz scroll
     function atualizarDestaqueVersiculo() {
         let versiculoDestacado = false;
         versiculosDoCapituloElementos.forEach((p, index) => {
             if (index === indiceVersiculoAtual && estadoLeitura === 'tocando') {
                 if (!p.classList.contains('lendo-agora')) {
                     p.classList.add('lendo-agora');
                     const rect = p.getBoundingClientRect();
                     if (rect.top < 0 || rect.bottom > window.innerHeight) {
                         p.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     }
                     console.log(`Destaque aplicado ao índice ${index}`);
                 }
                 versiculoDestacado = true;
             } else {
                 if (p.classList.contains('lendo-agora')) {
                     p.classList.remove('lendo-agora');
                     console.log(`Destaque removido do índice ${index}`);
                 }
             }
         });
         return versiculoDestacado;
     }

    // Botão Tocar/Pausar
    function tocarPausarLeitura() {
        if (isProcessingAudio) {
             console.warn("Play/Pause ignorado: processando áudio.");
             return; 
        }
        if (dadosVersiculosAtuais.length === 0) {
            console.warn("Nenhum versículo para ler.");
            return;
        }
        
        const btn = document.getElementById('play-pause-btn');
        if (!btn) { console.error("Botão Play/Pause não encontrado!"); return; }

        if(timeoutLimpezaAudio) {
            clearTimeout(timeoutLimpezaAudio);
            timeoutLimpezaAudio = null;
        }

        if (estadoLeitura === 'tocando') {
            console.log("Pausando leitura");
            pausarLeitura();
        } else { // 'parado' ou 'pausado'
            console.log("Iniciando/Retomando leitura");
            estadoLeitura = 'tocando';
            btn.innerHTML = '⏸️';

            if (audioAtual && audioAtual.paused && !isAudioPlaying) {
                console.log("Retomando áudio pausado...");
                isProcessingAudio = true; 
                toggleControlButtons(true);
                audioAtual.play().then(() => {
                    console.log("Retomada do play bem-sucedida.");
                    isAudioPlaying = true;
                    isProcessingAudio = false; 
                    toggleControlButtons(false); 
                    atualizarDestaqueVersiculo(); 
                }).catch(e => {
                    console.error("Erro ao retomar play:", e);
                    isProcessingAudio = false; 
                    toggleControlButtons(false);
                    pararLeitura(false);
                });
            } else {
                console.log("Iniciando ciclo 'lerProximoVersiculo' a partir do índice:", indiceVersiculoAtual);
                setTimeout(() => lerProximoVersiculo(), 50); 
            }
        }
    }

    // Função para Pausar
    function pausarLeitura() {
        console.log("Função pausarLeitura chamada");
        estadoLeitura = 'pausado';
        isAudioPlaying = false; 

        if(timeoutLimpezaAudio) {
            clearTimeout(timeoutLimpezaAudio);
            timeoutLimpezaAudio = null;
        }

        if (isProcessingAudio && abortController) {
             console.log("Pausando durante processamento: Abortando fetch TTS.");
             abortController.abort();
             abortController = null;
             isProcessingAudio = false; 
        }

        if (audioAtual && !audioAtual.paused) {
            console.log("Pausando audioAtual");
            try { audioAtual.pause(); } catch(e) { console.warn("Erro ao pausar (ignorado):", e); }
        } else {
            console.log("Pausar chamado, mas áudio já pausado/não existe ou processamento foi cancelado.");
        }

        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️';
        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) {
            versiculoLendo.classList.remove('lendo-agora');
        }
        
        toggleControlButtons(false); // Garante botões habilitados
    }

    // *** MODIFICADO: Função PararLeitura (Mais Robusta) ***
    function pararLeitura(resetarIndice = false) {
        console.log(`Parando leitura, resetarIndice: ${resetarIndice}, estado ANTES: ${estadoLeitura}`);
        const estadoAnterior = estadoLeitura; 
        estadoLeitura = 'parado'; 
        isAudioPlaying = false;

        // Cancela fetch pendente
        if (isProcessingAudio && abortController) {
            console.log("Parando durante processamento: Abortando fetch TTS.");
            abortController.abort();
            abortController = null;
        }

        // Limpa timeout de limpeza
        if(timeoutLimpezaAudio) {
            clearTimeout(timeoutLimpezaAudio);
            timeoutLimpezaAudio = null;
        }

        const audioParaLimpar = audioAtual; 
        const urlParaLimpar = audioAtualUrl; 
        audioAtual = null; 
        audioAtualUrl = null;

        if (audioParaLimpar) {
            console.log("Iniciando processo de parada para audioParaLimpar existente.");
            
            // *** CORREÇÃO: Remove listeners PRIMEIRO ***
            audioParaLimpar.onended = null; 
            audioParaLimpar.onerror = null;

            if (!audioParaLimpar.paused) {
                try {
                    audioParaLimpar.pause();
                    console.log("Audio pausado imediatamente.");
                } catch (e) { console.warn("Erro ao pausar áudio durante limpeza (ignorado):", e); }
            } else if (estadoAnterior === 'tocando') {
                console.warn("Parar chamado enquanto estado era 'tocando', mas áudio já estava pausado?");
            }

            console.log("Agendando limpeza final do áudio anterior (src)...");
            // Não revogar Data URLs
            
            setTimeout(() => {
                console.log("Executando limpeza final atrasada (src='').");
                try { 
                    if (audioParaLimpar && audioParaLimpar.src === urlParaLimpar) {
                        audioParaLimpar.src = ''; 
                    }
                } catch(e) { console.warn("Erro (ignorado) ao limpar src do áudio:", e); }
            }, 300); 
        }

        // Reset do índice e scroll
        if (resetarIndice) {
            console.log("Resetando índice para 0.");
            indiceVersiculoAtual = 0;
            areaLeitura.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Atualização da UI
        const versiculoLendo = document.querySelector('.lendo-agora');
        if (versiculoLendo) versiculoLendo.classList.remove('lendo-agora');
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶️';
        
        isProcessingAudio = false;
        toggleControlButtons(false);

        console.log(`Leitura parada completa. Índice final: ${indiceVersiculoAtual}`);
    }
    // --- FIM DA FUNÇÃO PARAR LEITURA ---

    // Habilita/Desabilita botões
    function toggleControlButtons(disabled) {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const stopBtn = document.getElementById('stop-btn');
        if(playPauseBtn) playPauseBtn.disabled = disabled;
        if(stopBtn) stopBtn.disabled = disabled;
    }


    // --- FUNÇÃO DE AVANÇO PARA O PRÓXIMO VERSÍCULO ---
    async function lerProximoVersiculo() {
        if (estadoLeitura !== 'tocando') {
             console.log("lerProximoVersiculo chamado, mas estado não é 'tocando'. Parando.");
             isProcessingAudio = false; 
             toggleControlButtons(false); 
             return;
        }

        if (indiceVersiculoAtual >= dadosVersiculosAtuais.length) {
            console.log('Fim do capítulo alcançado.');
            pararLeitura(true); 
            alert("Leitura do capítulo concluída!");
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

        atualizarDestaqueVersiculo(); // Adiciona destaque e scroll

        try {
            // *** CORREÇÃO: Callbacks definidos aqui para ter acesso a 'versiculoElementoAtual' ***
            const onAudioEndCallback = (event) => {
                console.log(`onAudioEndCallback: Áudio do índice ${indiceVersiculoAtual} terminou. Estado atual: ${estadoLeitura}`);
                isAudioPlaying = false; 
                
                // Limpa os listeners com segurança
                if (event && event.target) {
                    event.target.removeEventListener('ended', onAudioEndCallback);
                    event.target.removeEventListener('error', onAudioErrorCallback);
                }

                if (versiculoElementoAtual) { // Usa a variável capturada no escopo
                    versiculoElementoAtual.classList.remove('lendo-agora');
                }

                if (estadoLeitura === 'tocando') {
                    indiceVersiculoAtual++; // Avança para o próximo
                    // Chama o próximo ciclo
                    setTimeout(() => lerProximoVersiculo(), 100); // Pequena pausa antes do próximo
                } else {
                    console.log(`onAudioEndCallback: Estado mudou para ${estadoLeitura}. Interrompendo ciclo.`);
                    isProcessingAudio = false; 
                    toggleControlButtons(false); 
                }
            };
            
            // Define o callback de erro
            const onAudioErrorCallback = (errorEvent) => {
                console.error("Erro no elemento Audio (callback):", errorEvent);
                isAudioPlaying = false; isProcessingAudio = false;
                
                // Limpa os listeners com segurança
                if (errorEvent && errorEvent.target) {
                    errorEvent.target.removeEventListener('ended', onAudioEndCallback);
                    errorEvent.target.removeEventListener('error', onAudioErrorCallback);
                }

                toggleControlButtons(false); 
                // O alerta já é feito em lerTexto
                pararLeitura(false); // Para a leitura em caso de erro
            };

            console.log(`Iniciando chamada para índice ${indiceVersiculoAtual}`);
            // A função lerTexto agora retorna uma promessa que resolve ao fim do áudio
            await lerTexto(textoParaLer, onAudioEndCallback, onAudioErrorCallback); 

        } catch (error) {
            console.error(`Erro capturado no ciclo lerProximoVersiculo (índice ${indiceVersiculoAtual}):`, error ? error.message : 'Erro desconhecido');
            // pararLeitura já deve ter sido chamado dentro de lerTexto ou no callback de erro
            if (estadoLeitura !== 'parado') {
                 pararLeitura(false); 
            }
        }
    }
    // --- FIM DA FUNÇÃO DE AVANÇO ---


    // *** FUNÇÃO DE ÁUDIO (CHAMA O BACKEND E USA DATA URL PARA CACHE) ***
    function lerTexto(texto, onEndedCallback, onErrorCallback) { 

        // Limpa áudio anterior se existir
        if (isAudioPlaying && audioAtual) {
            console.warn("Áudio já estava tocando, parando antes de iniciar novo.");
            if(audioAtual && !audioAtual.paused) {
                try { audioAtual.pause(); } catch(e){}
            }
            audioAtual = null;
            audioAtualUrl = null; 
        }
        // Cancela fetch anterior se existir
        if (isProcessingAudio && abortController) {
             console.warn("Já processando áudio, abortando fetch anterior.");
             abortController.abort();
        }

        isProcessingAudio = true; 
        toggleControlButtons(true); 

        abortController = new AbortController();
        const signal = abortController.signal;

        const textoSanitizado = texto.trim(); // Sanitização básica
        if (!textoSanitizado) {
             console.warn("Texto vazio fornecido para lerTexto.");
             isProcessingAudio = false;
             toggleControlButtons(false);
             if (onEndedCallback) onEndedCallback(); // Pula para o próximo
             return Promise.resolve(); 
        }

        const cacheKey = `${textoSanitizado}_${NOME_DA_VOZ}_${taxaDeFala}`; // Usa voz padrão do script
        
        // *** LÓGICA DE CACHE COM DATA URL ***
        if (audioCache.has(cacheKey)) {
             console.log(`Áudio encontrado no cache para índice ${indiceVersiculoAtual}.`);
             const audioSrcFromCache = audioCache.get(cacheKey); 

             if (audioAtual) {
                 console.warn("Limpando referência de áudio anterior (cache).");
                 audioAtual = null; 
                 audioAtualUrl = null;
             }

             audioAtual = new Audio(audioSrcFromCache); 
             audioAtualUrl = audioSrcFromCache; // Guarda o URL
             console.log("Novo objeto audioAtual criado (cache):", audioAtual);
             isAudioPlaying = false; 

             return new Promise((resolve, reject) => {
                 // *** CORREÇÃO TYPEERROR: Handlers definidos ANTES e mais robustos ***
                 const handleErrorCache = (e) => {
                    console.error("Erro no áudio do cache:", e);
                    isAudioPlaying = false; isProcessingAudio = false;
                    audioCache.delete(cacheKey); // Remove do cache se deu erro
                    
                    // Verifica se o áudio que deu erro é o 'audioAtual' antes de anular
                    if (audioAtual && audioAtual.src === audioSrcFromCache) {
                        audioAtual = null;
                        audioAtualUrl = null;
                    }
                    
                    // Remove listeners com segurança, verificando e.target
                    if (e && e.target) {
                        e.target.removeEventListener('ended', handleEndedCache);
                        e.target.removeEventListener('error', handleErrorCache);
                    } else { console.warn("handleErrorCache: e.target indefinido."); }

                    toggleControlButtons(false); 
                    if (onErrorCallback) onErrorCallback(e); // Chama o callback de erro principal
                    reject(e);
                 };
                 
                 const handleEndedCache = (e) => {
                    console.log(`Evento 'ended' (cache) disparado.`);
                    isAudioPlaying = false;
                    
                    // Verifica se o áudio que terminou é o 'audioAtual' antes de anular
                    if (audioAtual && audioAtual.src === audioSrcFromCache) {
                        audioAtual = null;
                        audioAtualUrl = null;
                    }
                    
                    // Remove listeners com segurança
                    if (e && e.target) {
                        e.target.removeEventListener('ended', handleEndedCache);
                        e.target.removeEventListener('error', handleErrorCache);
                    } else { console.warn("handleEndedCache: e.target indefinido."); }
                    
                    if (onEndedCallback) onEndedCallback(e);
                    resolve();
                 };

                 audioAtual.addEventListener('ended', handleEndedCache);
                 audioAtual.addEventListener('error', handleErrorCache);

                 console.log("Tentando play() (cache)...");
                 audioAtual.play().then(() => {
                     console.log("Playback iniciado (cache).");
                     isAudioPlaying = true;
                     isProcessingAudio = false; 
                     toggleControlButtons(false);
                     // Promessa resolve no handleEndedCache
                 }).catch(playError => {
                     console.error("Erro direto no play() (cache):", playError);
                     handleErrorCache({ target: audioAtual }); // Passa o objeto audioAtual como target
                 });
             });
        }
        // *** FIM DA LÓGICA DE CACHE ***

        console.log(`Áudio não encontrado no cache para índice ${indiceVersiculoAtual}. Chamando backend...`);
        const bodyParaBackend = {
            text: textoSanitizado,
            voice: NOME_DA_VOZ, 
            speed: taxaDeFala   
        };
        
        // *** URL DO RENDER ***
        const backendUrl = 'https://meu-proxy-tts.onrender.com/synthesize'; 

        return fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(bodyParaBackend),
            signal: signal 
        })
        .then(res => {
            console.log("Resposta recebida do backend, status:", res.status);
             if (abortController && abortController.signal === signal) {
                  abortController = null;
             }

            if (!res.ok) {
                return res.json().catch(() => null).then(errData => {
                    const errorMessage = errData?.error || `Erro do backend: ${res.status} ${res.statusText}`;
                    console.error("Erro na resposta do backend:", errorMessage);
                    throw new Error(errorMessage);
                });
            }
            return res.json();
        })
        .then(data => {
             if (estadoLeitura !== 'tocando') {
                 console.warn("Estado mudou durante fetch/processamento TTS. Ignorando resposta.");
                 isProcessingAudio = false; 
                 toggleControlButtons(false); 
                 throw new Error("Leitura interrompida antes de tocar."); 
             }

            if (data.audioContent) {
                console.log("AudioContent recebido do backend.");
                // *** USA E CACHEIA DATA URL ***
                const audioSrc = "data:audio/mp3;base64," + data.audioContent;
                
                 if (audioAtual) {
                     console.warn("Limpando referência de áudio anterior (backend).");
                     audioAtual = null; // Só anula
                     audioAtualUrl = null;
                 }

                audioAtual = new Audio(audioSrc);
                audioAtualUrl = audioSrc; // Guarda URL
                console.log("Novo objeto audioAtual criado (backend):", audioAtual);
                isAudioPlaying = false; 

                audioCache.set(cacheKey, audioSrc); // Cacheia o Data URL
                console.log(`Áudio (Data URL) adicionado ao cache para índice ${indiceVersiculoAtual}.`);
                

                return new Promise((resolve, reject) => {
                    // *** CORREÇÃO TYPEERROR: Handlers definidos ANTES e mais robustos ***
                    const handleErrorBackend = (e) => {
                        console.error("Erro no elemento Audio (backend):", e);
                        isAudioPlaying = false; isProcessingAudio = false;
                        
                        // Verifica se o áudio que deu erro é o 'audioAtual' antes de anular
                        if (audioAtual && audioAtual.src === audioSrc) {
                             audioAtual = null; audioAtualUrl = null;
                         } else { console.warn("handleErrorBackend: audioAtual global mudou ou era null."); }

                        // Remove listeners com segurança
                        if (e && e.target) { 
                            e.target.removeEventListener('ended', handleEndedBackend);
                            e.target.removeEventListener('error', handleErrorBackend);
                        } else { console.warn("handleErrorBackend: e.target indefinido."); }

                        toggleControlButtons(false); 
                        alert("Erro ao carregar ou reproduzir o áudio do servidor.");
                        if (onErrorCallback) onErrorCallback(e); // Chama o callback de erro principal
                        reject(e);
                    };

                    const handleEndedBackend = (e) => {
                        console.log(`Evento 'ended' (backend) disparado.`);
                        isAudioPlaying = false;
                        
                        // Verifica se o áudio que terminou é o 'audioAtual' antes de anular
                        if (audioAtual && audioAtual.src === audioSrc) {
                             audioAtual = null; audioAtualUrl = null;
                         } else if (!audioAtual) {
                             console.log("Referência global audioAtual já era null em ended (backend).");
                         } else { console.warn("handleEndedBackend: audioAtual global mudou!"); }

                        // Remove listeners com segurança
                        if (e && e.target) {
                           e.target.removeEventListener('ended', handleEndedBackend);
                           e.target.removeEventListener('error', handleErrorBackend);
                        } else { console.warn("handleEndedBackend: e.target indefinido."); }

                        if (onEndedCallback) onEndedCallback(e);
                        resolve();
                    };

                    audioAtual.addEventListener('ended', handleEndedBackend);
                    audioAtual.addEventListener('error', handleErrorBackend);

                    console.log("Tentando play() (backend)...");
                    audioAtual.play().then(() => {
                        console.log("Playback iniciado (backend).");
                        isAudioPlaying = true;
                        isProcessingAudio = false; 
                        toggleControlButtons(false);
                        // Promessa resolve no handleEndedBackend
                    }).catch(playError => {
                        console.error("Erro direto no play() (backend):", playError);
                        handleErrorBackend({ target: audioAtual }); // Passa o objeto audioAtual como target
                    });
                });

            } else {
                console.error("Resposta do backend OK, mas sem audioContent:", data);
                throw new Error("Resposta do backend inválida (sem audioContent)");
            }
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                console.log(`Fetch para índice ${indiceVersiculoAtual} abortado.`);
                // Não alerta o usuário se foi intencional (AbortError)
            } else {
                alert(`Não foi possível obter o áudio do servidor: ${error.message}`);
                console.error(`Erro durante a chamada/processamento para índice ${indiceVersiculoAtual}:`, error);
            }

            // Garante liberação em caso de erro real
            if (error.name !== 'AbortError') {
                isProcessingAudio = false;
                toggleControlButtons(false);
            }
            if (abortController && abortController.signal === signal) abortController = null; 

            // Rejeita a promessa para parar o ciclo 'lerProximoVersiculo'
            return Promise.reject(error); 
        });
    }
    // *** FIM DA FUNÇÃO DE ÁUDIO ***


    // Função auxiliar para converter Base64 para Blob (usada apenas no download)
    function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
        // (Esta função não precisa de alterações)
        try {
             if (!b64Data || typeof b64Data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(b64Data.substring(0, 1024))) {
                  console.error("String Base64 inválida recebida:", b64Data.substring(0, 100) + "..."); 
                  throw new Error('Dados de áudio inválidos recebidos do servidor.');
             }

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
            return new Blob(byteArrays, { type: contentType });
        } catch (e) {
             console.error("Erro ao converter Base64 para Blob:", e);
             throw new Error("Falha ao decodificar dados de áudio recebidos."); 
        }
    }

    // --- CONEXÃO DO SLIDER DE VELOCIDADE ---
    const taxaFalaInput = document.getElementById('taxa-fala');
    const taxaFalaLabel = document.querySelector('.velocidade-control label');

    // Inicializa a label
    if (taxaFalaInput && taxaFalaLabel) {
        taxaDeFala = parseFloat(taxaFalaInput.value); 
        taxaFalaLabel.textContent = `Velocidade (${taxaDeFala.toFixed(2)}x)`;
    }

    taxaFalaInput.addEventListener('input', (event) => {
        taxaDeFala = parseFloat(event.target.value);
        if (taxaFalaLabel) {
            taxaFalaLabel.textContent = `Velocidade (${taxaDeFala.toFixed(2)}x)`;
        }
        console.log(`Velocidade de fala ajustada para: ${taxaDeFala}x`);
        audioCache.clear(); // Limpa cache ao mudar velocidade

        if (estadoLeitura === 'tocando' || estadoLeitura === 'pausado') {
            const indiceDeRetomada = indiceVersiculoAtual;
            pararLeitura(false);
            indiceVersiculoAtual = indiceDeRetomada;

            estadoLeitura = 'tocando';
            const btn = document.getElementById('play-pause-btn');
            if(btn) btn.innerHTML = '⏸️';
            setTimeout(() => {
                if (estadoLeitura === 'tocando') {
                    console.log("Reiniciando leitura após ajuste de velocidade.");
                    lerProximoVersiculo();
                } else {
                    console.log("Estado mudou após ajuste de velocidade, não reiniciando.");
                }
            }, 300); 
        }
    });
    // --- FIM DA CONEXÃO DO SLIDER ---
    
    // *** ADICIONA A DEFINIÇÃO DA FUNÇÃO DEBOUNCE ***
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    // *** FIM DA ADIÇÃO DO DEBOUNCE ***

    // Inicia o processo carregando a lista de livros
    popularLivros();

}); // Fecha o DOMContentLoaded