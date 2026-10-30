"use strict";

(() => {

    /* ================= ELEMENTOS ================= */
    const $ = (id) => document.getElementById(id);
    const reduzMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cena = $("cena");
    const card = $("card");
    const icone = $("icone");
    const btnSom = $("btnSom");
    const dMeta = $("dMeta");
    const dDep = $("dDep");
    const progresso = $("progresso");
    const anel = $("anel");
    const produto = $("produto");
    const saldoEl = $("saldo");
    const metaTexto = $("metaTexto");
    const inMeta = $("inMeta");
    const inDep = $("inDep");
    const chips = [...document.querySelectorAll("#velocidade .chip")];
    const presets = [...document.querySelectorAll(".preset")];
    const nota = $("nota");
    const btnAuto = $("btnAuto");
    const btnPasso = $("btnPasso");
    const btnReiniciar = $("btnReiniciar");
    const erroEl = $("erro");
    const resultado = $("resultado");
    const cMeta = $("cMeta");
    const cDep = $("cDep");
    const linhas = ["l1", "l2", "l3", "l4", "l5"].map($);
    const statusEl = $("status");
    const contadorEl = $("contador");
    const lista = $("lista");

    const CIRCUNFERENCIA = 2 * Math.PI * 70;

    /* ================= ESTADO ================= */
    // TODOS os valores em CENTAVOS (números inteiros): R$ 1,00 = 100
    let meta = 10000;
    let deposito = 2000;
    let modoCentavos = false;
    let saldo = 0;
    let depositos = 0;
    let gerador = null;       // o "while" do exercício vive aqui dentro
    let iniciado = false;
    let terminou = false;
    let rodandoAuto = false;
    let timer = null;
    let velocidade = 450;
    let somLigado = true;
    let rodada = 0;           // muda a cada reinício (cancela timeouts antigos)
    let exibido = 0;
    let rafNumero = 0;
    const tema = { rgb: "0,229,255" };

    /* ================= O EXERCÍCIO (WHILE) ================= */
    // Gerador: a cada next() ele faz UMA volta do while e devolve o novo saldo.
    // Quando a condição (saldo < meta) deixa de ser verdadeira, ele termina.
    function* maquina(metaFinal, valorDeposito) {
        let saldoInterno = 0;

        while (saldoInterno < metaFinal) {
            saldoInterno = saldoInterno + valorDeposito;
            yield saldoInterno;
        }

        return saldoInterno;
    }

    /* ================= SOM ================= */
    let audio = null;

    function tocar(freq, dur = 0.12, tipo = "sine", atraso = 0, vol = 0.08) {
        if (!somLigado) return;
        try {
            audio = audio || new (window.AudioContext || window.webkitAudioContext)();
            const t0 = audio.currentTime + atraso;
            const osc = audio.createOscillator();
            const ganho = audio.createGain();
            osc.type = tipo;
            osc.frequency.setValueAtTime(freq, t0);
            ganho.gain.setValueAtTime(vol, t0);
            ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            osc.connect(ganho).connect(audio.destination);
            osc.start(t0);
            osc.stop(t0 + dur);
        } catch (_) { /* sem áudio, segue o jogo */ }
    }

    // o "plim" da moeda fica mais agudo conforme o saldo sobe
    function somMoeda(progressoAtual) {
        const base = 520 + 520 * Math.min(progressoAtual, 1);
        tocar(base, 0.09, "square", 0, 0.035);
        tocar(base * 1.5, 0.22, "triangle", 0.07, 0.06);
    }

    const somSucesso = () => [523, 659, 784, 1047, 1319].forEach((f, i) => tocar(f, 0.25, "triangle", i * 0.09));
    const somErro    = () => { tocar(180, 0.18, "sawtooth"); tocar(130, 0.25, "sawtooth", 0.12); };
    const somClique  = () => tocar(660, 0.05, "sine", 0, 0.04);

    btnSom.addEventListener("click", () => {
        somLigado = !somLigado;
        btnSom.textContent = somLigado ? "🔊" : "🔇";
        somClique();
    });

    /* ================= UTILIDADES ================= */
    // centavos -> texto. Só mostra ",00" quando algum valor tem centavos
    function numero(centavos) {
        const casas = modoCentavos ? 2 : 0;
        return (centavos / 100).toLocaleString("pt-BR", {
            minimumFractionDigits: casas,
            maximumFractionDigits: casas,
        });
    }
    const dinheiro = (centavos) => "R$ " + numero(centavos);
    // como o número aparece no código JS (ponto no lugar da vírgula)
    const literal = (centavos) => String(centavos / 100);

    function definirTema(estado) {
        card.classList.remove("liberado", "rodando");
        if (estado) card.classList.add(estado);
        tema.rgb = estado === "liberado" ? "0,255,136" : estado === "rodando" ? "250,204,21" : "0,229,255";
    }

    function trocarIcone(emoji) {
        icone.textContent = emoji;
        icone.classList.remove("pop");
        void icone.offsetWidth;
        icone.classList.add("pop");
    }

    function tremer() {
        cena.classList.remove("tremer");
        void cena.offsetWidth;
        cena.classList.add("tremer");
        if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    }

    function mostrarErro(texto) {
        erroEl.textContent = texto;
        if (texto) { somErro(); tremer(); }
    }

    function acenderLinha(id) {
        linhas.forEach((l) => l.classList.toggle("ativa", l.id === id));
    }

    function atualizarStatus(texto, classe) {
        statusEl.textContent = texto;
        statusEl.className = classe;
    }

    /* ================= NÚMERO ANIMADO + ANEL ================= */
    function animarSaldo(para) {
        cancelAnimationFrame(rafNumero);
        const de = exibido;
        const t0 = performance.now();
        const dur = reduzMovimento ? 0 : 520;

        const passo = (t) => {
            const p = dur ? Math.min((t - t0) / dur, 1) : 1;
            const suave = 1 - Math.pow(1 - p, 3);
            exibido = Math.round(de + (para - de) * suave);
            saldoEl.textContent = dinheiro(exibido);
            if (p < 1) rafNumero = requestAnimationFrame(passo);
        };
        rafNumero = requestAnimationFrame(passo);

        saldoEl.classList.remove("bump");
        void saldoEl.offsetWidth;
        saldoEl.classList.add("bump");
    }

    function atualizarAnel() {
        const fracao = meta > 0 ? Math.min(saldo / meta, 1) : 0;
        progresso.style.strokeDashoffset = String(CIRCUNFERENCIA * (1 - fracao));
        anel.setAttribute("aria-label", `Saldo de ${dinheiro(saldo)} de ${dinheiro(meta)}`);
    }

    /* ================= CONFIGURAÇÃO ================= */
    // Converte "0,50", "0.50", "R$ 12,5", "1.250,75" em CENTAVOS inteiros (sem usar float)
    function lerValor(texto) {
        let t = texto.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
        if (t === "") return { vazio: true };

        if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");

        if (!/^\d+(\.\d+)?$/.test(t)) {
            return { erro: "digite só números (ex.: 0,50 ou 12.75)." };
        }

        const [inteiro, frac = ""] = t.split(".");
        if (frac.length > 2) {
            return { erro: "use no máximo 2 casas decimais (centavos)." };
        }

        return { centavos: Number(inteiro) * 100 + Number(frac.padEnd(2, "0")) };
    }

    function lerConfig() {
        const m = lerValor(inMeta.value);
        const d = lerValor(inDep.value);

        if (m.vazio || d.vazio) return { erro: "Preencha a meta e o depósito." };
        if (m.erro) return { erro: "Meta: " + m.erro };
        if (d.erro) return { erro: "Depósito: " + d.erro };

        if (m.centavos < 1 || d.centavos < 1) {
            return { erro: "Os valores precisam ser maiores que zero." };
        }
        if (m.centavos > 10000000) {
            return { erro: "A meta máxima é R$ 100.000,00." };
        }
        if (m.centavos / d.centavos > 200) {
            return { erro: "Muitos depósitos! Aumente o depósito ou diminua a meta." };
        }
        return { m: m.centavos, d: d.centavos };
    }

    function travarConfig(travar) {
        inMeta.disabled = travar;
        inDep.disabled = travar;
        presets.forEach((p) => { p.disabled = travar; });
    }

    function aplicarTextos() {
        modoCentavos = meta % 100 !== 0 || deposito % 100 !== 0;

        dMeta.textContent = dinheiro(meta);
        dDep.textContent = dinheiro(deposito);
        metaTexto.textContent = "de " + dinheiro(meta);
        saldoEl.textContent = dinheiro(exibido);
        cMeta.textContent = literal(meta);
        cDep.textContent = literal(deposito);
        nota.hidden = !modoCentavos;
    }

    function aoMudarConfig() {
        if (iniciado) return;
        const cfg = lerConfig();
        if (cfg.erro) {
            erroEl.textContent = "";
            return;
        }
        erroEl.textContent = "";
        meta = cfg.m;
        deposito = cfg.d;
        aplicarTextos();
        atualizarAnel();
    }

    inMeta.addEventListener("input", aoMudarConfig);
    inDep.addEventListener("input", aoMudarConfig);

    presets.forEach((botao) => {
        botao.addEventListener("click", () => {
            if (iniciado) return;
            inMeta.value = botao.dataset.meta;
            inDep.value = botao.dataset.dep;
            erroEl.textContent = "";
            aoMudarConfig();
            somClique();
        });
    });

    /* ================= CONTROLE DA MÁQUINA ================= */
    function iniciarSeNecessario() {
        if (iniciado) return true;

        const cfg = lerConfig();
        if (cfg.erro) {
            mostrarErro(cfg.erro);
            return false;
        }

        erroEl.textContent = "";
        meta = cfg.m;
        deposito = cfg.d;
        aplicarTextos();

        gerador = maquina(meta, deposito);
        iniciado = true;
        travarConfig(true);

        definirTema("rodando");
        trocarIcone("⚙️");
        acenderLinha("l1");
        atualizarStatus("saldo = 0 → máquina ligada", "espera");
        resultado.textContent = "";
        return true;
    }

    // Uma volta do while
    function avancar() {
        if (!iniciado || terminou) return;
        const minhaRodada = rodada;

        const passo = gerador.next();
        if (passo.done) { finalizar(); return; }

        saldo = passo.value;
        depositos++;
        const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        // histórico
        const li = document.createElement("li");
        const texto = document.createElement("span");
        const small = document.createElement("small");
        texto.textContent = `#${depositos}  + ${dinheiro(deposito)}  →  ${dinheiro(saldo)}`;
        small.textContent = hora;
        li.append(texto, small);
        lista.appendChild(li);
        lista.scrollTop = lista.scrollHeight;
        contadorEl.textContent = depositos;

        // visual
        animarSaldo(saldo);
        atualizarAnel();
        somMoeda(saldo / meta);
        if (!reduzMovimento) emitirMoedas(14);

        // linha do código que acabou de rodar
        acenderLinha("l3");

        const continua = saldo < meta;
        atualizarStatus(
            `${numero(saldo)} < ${numero(meta)}  →  ${continua ? "verdadeiro (repete)" : "falso (termina)"}`,
            continua ? "verdade" : "falso"
        );

        setTimeout(() => {
            if (minhaRodada !== rodada) return;
            acenderLinha(continua ? "l2" : "l4");
        }, Math.min(260, velocidade / 2));

        // condição deixou de ser verdadeira: fecha o while
        if (!continua) {
            gerador.next();
            setTimeout(() => {
                if (minhaRodada === rodada) finalizar();
            }, Math.min(520, velocidade));
        }
    }

    function finalizar() {
        if (terminou) return;
        terminou = true;
        pararAuto();

        acenderLinha("l5");
        const sobra = saldo - meta;
        resultado.textContent =
            `Saldo acumulado: ${dinheiro(saldo)} — Produto liberado! 🎉` +
            (sobra > 0 ? ` (sobraram ${dinheiro(sobra)})` : "");

        const li = document.createElement("li");
        li.className = "final";
        const t = document.createElement("span");
        t.textContent = `🎁 Produto liberado com ${dinheiro(saldo)}`;
        li.appendChild(t);
        lista.appendChild(li);
        lista.scrollTop = lista.scrollHeight;

        produto.textContent = "🎧";
        produto.classList.add("livre");
        definirTema("liberado");
        trocarIcone("🎉");
        somSucesso();
        if (!reduzMovimento) confete();

        btnAuto.disabled = true;
        btnPasso.disabled = true;
    }

    /* ---- modo automático ---- */
    function pararAuto() {
        rodandoAuto = false;
        clearTimeout(timer);
        btnAuto.textContent = terminou ? "✔ Concluído" : "▶ Continuar";
    }

    function ciclo() {
        if (!rodandoAuto || terminou) return;
        const minhaRodada = rodada;
        avancar();
        if (rodandoAuto && !terminou) {
            timer = setTimeout(() => {
                if (minhaRodada === rodada) ciclo();
            }, velocidade);
        }
    }

    function alternarAuto() {
        if (terminou) return;

        if (rodandoAuto) {
            pararAuto();
            somClique();
            return;
        }

        if (!iniciarSeNecessario()) return;
        rodandoAuto = true;
        btnAuto.textContent = "⏸ Pausar";
        somClique();
        ciclo();
    }

    /* ---- modo um por vez ---- */
    function depositarUm() {
        if (terminou) return;
        if (rodandoAuto) pararAuto();
        if (!iniciarSeNecessario()) return;
        avancar();
    }

    /* ---- reiniciar ---- */
    function reiniciar() {
        rodada++;
        clearTimeout(timer);
        cancelAnimationFrame(rafNumero);

        saldo = 0;
        depositos = 0;
        exibido = 0;
        gerador = null;
        iniciado = false;
        terminou = false;
        rodandoAuto = false;

        saldoEl.textContent = dinheiro(0);
        contadorEl.textContent = "0";
        lista.innerHTML = "";
        resultado.textContent = "";
        erroEl.textContent = "";
        produto.textContent = "🔒";
        produto.classList.remove("livre");

        travarConfig(false);
        btnAuto.disabled = false;
        btnPasso.disabled = false;
        btnAuto.textContent = "▶ Rodar automático";

        definirTema("");
        trocarIcone("🏧");
        acenderLinha("");
        atualizarStatus("Aguardando início…", "espera");

        const cfg = lerConfig();
        if (!cfg.erro) { meta = cfg.m; deposito = cfg.d; }
        aplicarTextos();
        atualizarAnel();
        somClique();
    }

    btnAuto.addEventListener("click", alternarAuto);
    btnPasso.addEventListener("click", depositarUm);
    btnReiniciar.addEventListener("click", reiniciar);

    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            chips.forEach((c) => c.classList.remove("ativo"));
            chip.classList.add("ativo");
            velocidade = Number(chip.dataset.ms);
            somClique();

            // aplica a nova velocidade na hora, se estiver rodando
            if (rodandoAuto && !terminou) {
                clearTimeout(timer);
                const minhaRodada = rodada;
                timer = setTimeout(() => {
                    if (minhaRodada === rodada) ciclo();
                }, velocidade);
            }
        });
    });

    /* ================= TECLADO ================= */
    document.addEventListener("keydown", (e) => {
        const noCampo = e.target instanceof HTMLInputElement;
        if (noCampo || e.ctrlKey || e.metaKey || e.altKey) return;

        const tecla = e.key.toLowerCase();
        if (tecla === "a") { alternarAuto(); }
        else if (tecla === "r") { reiniciar(); }
        else if (e.code === "Space") {
            // evita clicar duas vezes quando um botão está com foco
            if (e.target instanceof HTMLButtonElement) return;
            e.preventDefault();
            depositarUm();
        }
    });

    /* ================= TILT 3D ================= */
    if (!reduzMovimento && matchMedia("(hover: hover)").matches) {
        document.addEventListener("pointermove", (e) => {
            const x = e.clientX / innerWidth - 0.5;
            const y = e.clientY / innerHeight - 0.5;
            card.style.setProperty("--rx", `${(-y * 5).toFixed(2)}deg`);
            card.style.setProperty("--ry", `${(x * 7).toFixed(2)}deg`);
        });
        document.addEventListener("pointerleave", () => {
            card.style.setProperty("--rx", "0deg");
            card.style.setProperty("--ry", "0deg");
        });
    }

    /* ================= FUNDO: REDE DE PARTÍCULAS ================= */
    function iniciarFundo() {
        const canvas = $("fundo");
        const ctx = canvas.getContext("2d");
        const mouse = { x: -9999, y: -9999 };
        let w, h, particulas = [];

        function ajustar() {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = innerWidth;
            h = innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const qtd = Math.min(100, Math.floor((w * h) / 14000));
            particulas = Array.from({ length: qtd }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                r: Math.random() * 1.6 + 0.7,
            }));
        }

        addEventListener("resize", ajustar);
        addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
        addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
        ajustar();

        function quadro() {
            ctx.clearRect(0, 0, w, h);
            const cor = tema.rgb;

            for (let i = 0; i < particulas.length; i++) {
                const p = particulas[i];

                if (!reduzMovimento) {
                    const dx = mouse.x - p.x;
                    const dy = mouse.y - p.y;
                    const d = Math.hypot(dx, dy);
                    if (d < 160 && d > 1) {
                        p.vx += (dx / d) * 0.012;
                        p.vy += (dy / d) * 0.012;
                    }
                    p.vx *= 0.995;
                    p.vy *= 0.995;
                    p.x += p.vx;
                    p.y += p.vy;
                    if (p.x < 0 || p.x > w) p.vx *= -1;
                    if (p.y < 0 || p.y > h) p.vy *= -1;
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${cor},.85)`;
                ctx.fill();

                for (let j = i + 1; j < particulas.length; j++) {
                    const q = particulas[j];
                    const dist = Math.hypot(p.x - q.x, p.y - q.y);
                    if (dist < 120) {
                        ctx.strokeStyle = `rgba(${cor},${(1 - dist / 120) * 0.35})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.stroke();
                    }
                }

                const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y);
                if (dm < 150) {
                    ctx.strokeStyle = `rgba(${cor},${(1 - dm / 150) * 0.6})`;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }

            if (!reduzMovimento) requestAnimationFrame(quadro);
        }
        quadro();
    }

    /* ================= EFEITOS: MOEDAS E CONFETE ================= */
    const canvasFx = $("efeitos");
    const fx = canvasFx.getContext("2d");
    let pecas = [];
    let fxRodando = false;

    function ajustarFx() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvasFx.width = innerWidth * dpr;
        canvasFx.height = innerHeight * dpr;
        fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    addEventListener("resize", ajustarFx);
    ajustarFx();

    function origemAnel() {
        const r = anel.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function emitirMoedas(qtd) {
        const o = origemAnel();
        for (let i = 0; i < qtd; i++) {
            const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
            const vel = Math.random() * 7 + 4;
            pecas.push({
                tipo: "moeda",
                x: o.x, y: o.y,
                vx: Math.cos(ang) * vel,
                vy: Math.sin(ang) * vel,
                tam: Math.random() * 6 + 8,
                rot: Math.random() * Math.PI * 2,
                vrot: (Math.random() - 0.5) * 0.5,
                vida: 1,
            });
        }
        ligarFx();
    }

    function confete() {
        const o = origemAnel();
        const cores = ["#00ff88", "#00e5ff", "#facc15", "#fb7185", "#a78bfa", "#ffffff"];
        for (let i = 0; i < 220; i++) {
            const ang = Math.random() * Math.PI * 2;
            const vel = Math.random() * 13 + 4;
            pecas.push({
                tipo: "confete",
                x: o.x, y: o.y,
                vx: Math.cos(ang) * vel,
                vy: Math.sin(ang) * vel - 6,
                tam: Math.random() * 8 + 4,
                rot: Math.random() * Math.PI,
                vrot: (Math.random() - 0.5) * 0.4,
                cor: cores[(Math.random() * cores.length) | 0],
                redonda: Math.random() < 0.3,
                vida: 1,
            });
        }
        ligarFx();
    }

    function ligarFx() {
        if (fxRodando) return;
        fxRodando = true;
        requestAnimationFrame(quadroFx);
    }

    function quadroFx() {
        fx.clearRect(0, 0, innerWidth, innerHeight);

        pecas = pecas.filter((p) => p.vida > 0 && p.y < innerHeight + 40);

        for (const p of pecas) {
            p.vy += p.tipo === "moeda" ? 0.45 : 0.28;
            p.vx *= 0.992;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vrot;
            if (p.tipo === "moeda") p.vida -= 0.012;

            fx.save();
            fx.translate(p.x, p.y);
            fx.globalAlpha = Math.max(Math.min(p.vida, 1), 0);

            if (p.tipo === "moeda") {
                // moeda girando: achata o eixo X com o cosseno
                fx.scale(Math.abs(Math.cos(p.rot)) * 0.85 + 0.15, 1);
                fx.beginPath();
                fx.arc(0, 0, p.tam, 0, Math.PI * 2);
                fx.fillStyle = "#facc15";
                fx.fill();
                fx.lineWidth = 2;
                fx.strokeStyle = "#ca8a04";
                fx.stroke();
                fx.beginPath();
                fx.arc(0, 0, p.tam * 0.55, 0, Math.PI * 2);
                fx.strokeStyle = "rgba(202,138,4,.8)";
                fx.lineWidth = 1.2;
                fx.stroke();
            } else {
                fx.rotate(p.rot);
                fx.fillStyle = p.cor;
                if (p.redonda) {
                    fx.beginPath();
                    fx.arc(0, 0, p.tam / 2, 0, Math.PI * 2);
                    fx.fill();
                } else {
                    fx.fillRect(-p.tam / 2, -p.tam / 4, p.tam, p.tam / 2);
                }
            }
            fx.restore();
        }

        if (pecas.length) {
            requestAnimationFrame(quadroFx);
        } else {
            fxRodando = false;
            fx.clearRect(0, 0, innerWidth, innerHeight);
        }
    }

    /* ================= INÍCIO ================= */
    iniciarFundo();
    aplicarTextos();
    atualizarAnel();

})();