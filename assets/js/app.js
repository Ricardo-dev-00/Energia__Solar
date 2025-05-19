document.querySelector('.container__form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const cep = document.getElementById('cep').value;
    const consumo = Number(document.getElementById('consumo').value);
    const tarifa = Number(document.getElementById('tarifa').value);
    const potenciaPlaca = Number(document.getElementById('potencia-placa').value); // <-- PEGANDO A POTÊNCIA ESCOLHIDA

    try {
        // 1. Buscar coordenadas pelo CEP
        const { lat, lon } = await cepToLatLng(cep);

        // 2. Buscar irradiação solar média
        const irradiacao = await getIrradiacao(lat, lon);

        // 3. Calcular número de placas e potência
        const resultadoPlacas = calcularPlacas(consumo, irradiacao, potenciaPlaca); // <-- USANDO A POTÊNCIA ESCOLHIDA

        // 4. Exibir resultados
        document.getElementById('numero-placas').textContent =
            `${resultadoPlacas.quantidade} placa(s) de ${resultadoPlacas.potenciaPlaca}W`;
        document.getElementById('resultado-irradiacao').textContent = `${irradiacao.toFixed(1)} kWh/m²/dia`;
        document.getElementById('resultado-irradiacao-texto').textContent = classificarIrradiacao(irradiacao);
    } catch (err) {
        alert('Erro ao buscar dados: ' + err.message);
    }
});

// Função para classificar a irradiação solar
function classificarIrradiacao(irradiacao) {
    if (irradiacao >= 5.5) return 'Excelente!';
    if (irradiacao >= 4.5) return 'Boa!';
    if (irradiacao >= 3.5) return 'Regular';
    return 'Fraca';
}

// Função para converter CEP em latitude e longitude
async function cepToLatLng(cep) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${cep}, Brasil`);
    const data = await response.json();
    if (data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon };
    }
    throw new Error('CEP não encontrado');
}

// Função para buscar irradiação solar média na NASA POWER
async function getIrradiacao(lat, lon) {
    const response = await fetch(
        `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude=${lon}&latitude=${lat}&format=JSON`
    );
    const data = await response.json();
    const valores = Object.values(data.properties.parameter.ALLSKY_SFC_SW_DWN);
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    return media;
}

// Função para calcular o número de placas solares necessárias
function calcularPlacas(consumoMensal, irradiacaoMedia, potenciaPlaca = 450, eficiencia = 0.8) {
    const energiaPorPlacaMes = (potenciaPlaca / 1000) * irradiacaoMedia * 30 * eficiencia;
    const quantidade = Math.ceil(consumoMensal / energiaPorPlacaMes);
    return { quantidade, potenciaPlaca };
}

function estimarInvestimento(qtdPlacas, potenciaPlaca, custoInstalacao = 3000) {
    const precoPlaca = precoPlacaPorPotencia(potenciaPlaca);
    return qtdPlacas * precoPlaca + custoInstalacao;
}

function calcularAreaTelhado(qtdPlacas, areaPlaca = 2) {
    return qtdPlacas * areaPlaca;
}

function calcularEconomia(consumoMensal, precoKwh) {
    return consumoMensal * precoKwh;
}

function precoPlacaPorPotencia(potenciaPlaca) {
    // Você pode ajustar os valores conforme o mercado
    switch (potenciaPlaca) {
        case 150: return 450;
        case 300: return 500;
        case 400: return 650;
        case 450: return 750;
        case 500: return 850;
        case 550: return 900;
        default: return 1200;
    }
}

document.getElementById('download-relatorio').addEventListener('click', function () {
    // Pegando os valores exibidos na tela
    const cep = document.getElementById('cep').value || '-';
    const consumo = Number(document.getElementById('consumo').value) || 0;
    const tarifa = Number(document.getElementById('tarifa').value) || 0.95;
    const potenciaPlaca = Number(document.getElementById('potencia-placa').value) || 450; // <-- PEGANDO A POTÊNCIA ESCOLHIDA
    const placasTexto = document.getElementById('numero-placas').textContent || '';
    const irradiacao = Number((document.getElementById('resultado-irradiacao').textContent || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
    const irradiacaoTexto = document.getElementById('resultado-irradiacao-texto').textContent || '-';

    // Extrai quantidade de placas do texto exibido
    const matchPlacas = placasTexto.match(/(\d+)\s*placa\(s\)/i);
    const qtdPlacas = matchPlacas ? Number(matchPlacas[1]) : 0;

    // Cálculos auxiliares
    const investimento = estimarInvestimento(qtdPlacas, potenciaPlaca);
    const areaTelhado = calcularAreaTelhado(qtdPlacas);
    const economia = calcularEconomia(consumo, tarifa);
    const economiaAnual = economia * 12;
    const payback = economiaAnual > 0 ? (investimento / economiaAnual).toFixed(1) : '-';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Centralizar o título principal
    doc.setFontSize(22);
    const pageWidth = doc.internal.pageSize.getWidth();
    const title = "Projeção de Dimensionamento";
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, 18);

    // Centralizar o subtítulo
    doc.setFontSize(16);
    const subtitle = "Sistema Solar Residencial";
    const subtitleWidth = doc.getTextWidth(subtitle);
    doc.text(subtitle, (pageWidth - subtitleWidth) / 2, 28);

    let y = 48;
    doc.setFontSize(12);

    // 1. Dados do Usuário
    doc.setFont(undefined, 'bold');
    doc.text("1. Dados do Usuário", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text(`CEP informado: ${cep}`, 18, y);
    y += 6;
    doc.text(`Consumo médio mensal: ${consumo} kWh`, 18, y);
    y += 6;
    doc.text(`Tarifa de energia: R$ ${tarifa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kWh`, 18, y);

    // 2. Irradiação Solar Média
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text("2. Irradiação Solar Média", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text(`Irradiação média local: ${irradiacao} kWh/m²/dia`, 18, y);
    y += 6;
    doc.text(`Classificação: ${irradiacaoTexto}`, 18, y);

    // 3. Estimativa de Investimento
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text("3. Estimativa de Investimento", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text(`Faixa de custo do sistema: R$ ${investimento.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, y);
    y += 6;
    doc.text(`(considerando equipamentos, instalação e conexão)`, 18, y);

    // 4. Escolha das Placas
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text("4. Escolha das Placas", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text(`Modelo da placa: ${potenciaPlaca} Wp`, 18, y); // <-- MOSTRANDO O MODELO ESCOLHIDO
    y += 6;
    doc.text(`Quantidade necessária: ${qtdPlacas} placa(s) de ${potenciaPlaca} Wp`, 18, y);

    // 5. Área Necessária no Telhado
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text("5. Área Necessária no Telhado", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text(`Área total estimada: ${areaTelhado} m²`, 18, y);

    // 6. Economia Esperada
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text("6. Economia Esperada", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text(`Economia mensal estimada: R$ ${economia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, y);
    y += 6;
    doc.text(`Economia anual: R$ ${economiaAnual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 18, y);
    y += 6;
    doc.text(`Tempo de retorno do investimento: ${payback} anos (estimado)`, 18, y);

    // 7. Condições Ideais de Instalação
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text("7. Condições Ideais de Instalação", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text("Telhado orientado para o norte (ideal)", 18, y);
    y += 6;
    doc.text("Sem sombreamento de árvores, prédios, etc.", 18, y);

    // 8. Componentes do Sistema
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text("8. Componentes do Sistema", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text("• Placas solares (módulos fotovoltaicos)", 18, y);
    y += 6;
    doc.text("• Inversor solar", 18, y);
    y += 6;
    doc.text("• Estrutura de fixação", 18, y);
    y += 6;
    doc.text("• Cabeamento elétrico", 18, y);
    y += 6;
    doc.text("• Disjuntores e proteções", 18, y);

    // 9. Observações Regulatórias
    y += 10;
    doc.setFont(undefined, 'bold');
    doc.text("9. Observações Regulatórias", 15, y);
    doc.setFont(undefined, 'normal');
    y += 7;
    doc.text("• Sistema conectado à rede elétrica da concessionária", 18, y);
    y += 6;
    doc.text("• Necessário cadastro e aprovação para geração distribuída", 18, y);
    y += 6;
    doc.text("• Geração de créditos energéticos quando houver excedente", 18, y);

    doc.save('relatorio-solar.pdf');
});