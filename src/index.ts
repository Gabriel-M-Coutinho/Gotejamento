import inquirer from 'inquirer';
import { CotejamentoService } from './services/cotejamento';
import { ExcelService } from './services/excel';

async function main() {
  let exit = false;
  let retorno: any = [];
  let excelCliente = "";
  let excelGalileu = "";

  while (!exit) {
    const { option } = await inquirer.prompt([
      {
        type: 'list',
        name: 'option',
        message: 'Escolha uma opção:',
        choices: [
          { name: 'Cotejar', value: 1 },
          { name: 'Selecionar planilhas', value: 2 },
          { name: 'Gerar planilha', value: 3 },
          { name: 'Sair', value: 0 },
        ],
      },
    ]);

    switch (option) {
      case 1:
        if (excelCliente === "" || excelGalileu === "") {
          console.log("Selecione as planilhas antes de iniciar.");
          break;
        }
        retorno = await CotejamentoService.Cotejar(excelCliente, excelGalileu);
        console.log("Resultado do cotejamento:", retorno);
        break;

      case 2:
        excelCliente = await selecionarPlanilha("cliente");
        excelGalileu = await selecionarPlanilha("Galileu");
        console.log("Planilhas selecionadas:");
        console.log("Cliente:", excelCliente);
        console.log("Galileu:", excelGalileu);
        break;

      case 3:
        ExcelService.WriteExcel("trabalho_atualizado.xlsx",retorno)
        break;

      case 0:
        exit = true;
        console.log('Saindo...');
        break;
    }
  }
}


async function selecionarPlanilha(tipo: string): Promise<string> {
  const { caminho } = await inquirer.prompt([
    {
      type: 'input',
      name: 'caminho',
      message: `Digite o caminho completo da planilha ${tipo}:`,
    },
  ]);
  return caminho;
}

main();
