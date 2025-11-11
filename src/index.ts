import inquirer from "inquirer";
import { CotejamentoTurboService } from "./services/cotejamento";
import { ExcelService } from "./services/excel";
import { CorretorOrtograficoService } from "./services/ortografia";

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  let exit = false;
  let retorno: any[] = [];
  let dataCliente: any[] = [];
  let dataGalileu: any[] = [];
  let excelCliente = "";
  let excelGalileu = "";

  while (!exit) {
    const { option } = await inquirer.prompt([
      {
        type: "list",
        name: "option",
        message: "Escolha uma opção:",
        choices: [
          { name: "Selecionar planilhas", value: 1 },
          { name: "Corrigir descrições do Galileu", value: 2 },
          { name: "Cotejar", value: 3 },
          { name: "Gerar planilha", value: 4 },
          { name: "Sair", value: 0 },
        ],
      },
    ]);

    switch (option) {
      // Selecionar planilhas
      case 1:
        excelCliente = await selecionarPlanilha("cliente");
        excelGalileu = await selecionarPlanilha("Galileu");

        console.log("\n📂 Carregando planilhas em memória...");
        try {
          dataCliente = ExcelService.ReadExcel(excelCliente);
          console.log(`✅ Planilha Cliente carregada: ${dataCliente.length} linhas`);

          dataGalileu = ExcelService.ReadExcel(excelGalileu);
          console.log(`✅ Planilha Galileu carregada: ${dataGalileu.length} linhas`);

          console.log("\n📋 Planilhas prontas para cotejamento!");
        } catch (error) {
          console.error("❌ Erro ao carregar planilhas:", error);
          dataCliente = [];
          dataGalileu = [];
        }
        break;

      // Corrigir descrições do Galileu
      case 2:
        if (dataGalileu.length === 0) {
          console.log("⚠️  Carregue a planilha do Galileu primeiro!");
          break;
        }

        const colunasGalileu = Object.keys(dataGalileu[0]);
        const { colunaDescricao } = await inquirer.prompt([
          {
            type: "list",
            name: "colunaDescricao",
            message: "Selecione a coluna de descrição para corrigir:",
            choices: colunasGalileu,
          },
        ]);

        const { nomeCampoNovo } = await inquirer.prompt([
          {
            type: "input",
            name: "nomeCampoNovo",
            message: "Nome do novo campo para salvar as descrições corrigidas:",
            default: `${colunaDescricao}_corrigida`,
          },
        ]);

        console.log(`🔄 Corrigindo textos da coluna "${colunaDescricao}"...`);
        const inicio = Date.now();

        const CONCURRENCY = 3; // máximo de 3 correções simultâneas
        const resultados: any[] = [];

        for (let i = 0; i < dataGalileu.length; i += CONCURRENCY) {
          const lote = dataGalileu.slice(i, i + CONCURRENCY);

          const promessas = lote.map(async (linha, j) => {
            const texto = String(linha[colunaDescricao] || "").trim();
            if (!texto) {
              linha[nomeCampoNovo] = "";
              return linha;
            }

            try {
              const corrigido = await CorretorOrtograficoService.corrigirTexto(texto);
              linha[nomeCampoNovo] = corrigido;
            } catch (e) {
              linha[nomeCampoNovo] = texto;
            }

            return linha;
          });

          const resultadosLote = await Promise.all(promessas);
          resultados.push(...resultadosLote);

          process.stdout.write(
            `\r🧠 Processando linhas ${Math.min(i + CONCURRENCY, dataGalileu.length)}/${dataGalileu.length}`
          );

          await delay(1500); // espera 1.5s entre lotes (respeita o limite)
        }

        dataGalileu = resultados;

        const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
        console.log(`\n✅ Correção concluída em ${duracao}s!`);
        console.log(`📝 Novo campo criado: ${nomeCampoNovo}`);

        // Pergunta se quer salvar logo a planilha corrigida
        const { salvarAgora } = await inquirer.prompt([
          {
            type: "confirm",
            name: "salvarAgora",
            message: "Deseja salvar uma cópia da planilha corrigida agora?",
            default: true,
          },
        ]);

        if (salvarAgora) {
          const { nomeArquivoCorrigido } = await inquirer.prompt([
            {
              type: "input",
              name: "nomeArquivoCorrigido",
              message: "Nome do arquivo de saída:",
              default: "galileu_corrigido.xlsx",
            },
          ]);
          ExcelService.WriteExcel(nomeArquivoCorrigido, dataGalileu);
          console.log(`✅ Planilha corrigida salva como: ${nomeArquivoCorrigido}`);
        }
        break;

      // Cotejar
      case 3:
        if (dataCliente.length === 0 || dataGalileu.length === 0) {
          console.log("⚠️  Selecione as planilhas antes de iniciar o cotejamento.");
          break;
        }
        console.log("🔄 Iniciando cotejamento...");
        retorno = await CotejamentoTurboService.CotejarInterativo(dataCliente, dataGalileu);
        console.log(`✅ Cotejamento concluído! ${retorno.length} matches encontrados.`);
        break;

      // Gerar planilha
      case 4:
        const { tipoPlanilha } = await inquirer.prompt([
          {
            type: "list",
            name: "tipoPlanilha",
            message: "Qual planilha deseja exportar?",
            choices: [
              { name: "Planilha do Cliente", value: "cliente" },
              { name: "Planilha do Galileu", value: "galileu" },
              { name: "Resultado do Cotejamento", value: "retorno" },
            ],
          },
        ]);

        let dadosParaExportar: any[] = [];
        if (tipoPlanilha === "cliente") dadosParaExportar = dataCliente;
        else if (tipoPlanilha === "galileu") dadosParaExportar = dataGalileu;
        else if (tipoPlanilha === "retorno") dadosParaExportar = retorno;

        if (!dadosParaExportar || dadosParaExportar.length === 0) {
          console.log("⚠️  Nenhum dado disponível para exportar.");
          break;
        }

        const { nomeArquivo } = await inquirer.prompt([
          {
            type: "input",
            name: "nomeArquivo",
            message: "Nome do arquivo de saída:",
            default:
              tipoPlanilha === "retorno"
                ? "cotejamento_resultado.xlsx"
                : `${tipoPlanilha}_exportado.xlsx`,
          },
        ]);

        ExcelService.WriteExcel(nomeArquivo, dadosParaExportar);
        console.log(`✅ Planilha gerada com sucesso: ${nomeArquivo}`);
        break;

      // Sair
      case 0:
        exit = true;
        console.log("👋 Saindo...");
        break;
    }
  }
}

async function selecionarPlanilha(tipo: string): Promise<string> {
  const { caminho } = await inquirer.prompt([
    {
      type: "input",
      name: "caminho",
      message: `📁 Digite o caminho completo da planilha ${tipo}:`,
    },
  ]);
  return caminho;
}

main();
