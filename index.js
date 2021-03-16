const puppeteer     = require('puppeteer');
const readlineSync  = require('readline-sync');
const {Parser}     = require('json2csv');
const fs            = require('fs');
const cliProgress = require('cli-progress');

(async () => {
    const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    console.log('PORTAL DE SERVIÇOS - REALIZAR LOGIN');
    const cpf   = readlineSync.question('Informe o CPF: ');
    const senha = readlineSync.question('Informe a SENHA: ', {hideEchoBack: true});
    const adv = readlineSync.question('Informe o nome do ADVOGADO: ');

    const url = "https://esaj.tjsp.jus.br/sajcas/login?service=https%3A%2F%2Fesaj.tjsp.jus.br%2Fesaj%2Fj_spring_cas_security_check";

    const browser   = await puppeteer.launch({ headless: false });
    const page      = await browser.newPage();
    await page.goto(url);

    await page.type('#usernameForm', cpf);
    await page.type('#passwordForm', senha);

    await page.click('#pbEntrar');

    await page.waitForSelector('#quantidadeProcessosNaPagina');   

    let processos = [];
    let {totalPaginas, totalRegistros} = await page.evaluate(async() => {
        return {
            totalPaginas    : parseInt($('#quantidadeProcessosNaPagina').html().split(' ')[3]),
            totalRegistros  : parseInt($('#contadorDeProcessos').text())
        }
    });
    bar1.start(totalRegistros, 0);
    totalPaginas = parseInt(totalRegistros/totalPaginas) + 1;

    for(let pagina = 1; pagina <= totalPaginas; pagina++){
        // console.log('PAGINA: ', pagina);
        const url = "https://esaj.tjsp.jus.br/cpopg/trocarPagina.do?paginaConsulta="+pagina+"&conversationId=&cbPesquisa=NMADVOGADO&dadosConsulta.valorConsulta="+adv+"&dadosConsulta.localPesquisa.cdLocal=-1";
        await page.goto(url);
        await page.waitForSelector('#quantidadeProcessosNaPagina');

        const urlProcessos = await page.evaluate(async() => {
            let enderecos = [];
            let linksDOM = $('.linkProcesso');        

            for(let i = 0; i < linksDOM.length; i++){
                enderecos.push(linksDOM[i].href);
            }

            return enderecos;
        });

        // console.log('TOTAL PROCESSOS: ', urlProcessos.length);

        for(let i = 0; i < urlProcessos.length; i++){
            bar1.update(urlProcessos.length * pagina);
            let url = urlProcessos[i];
            await page.goto(url);
            await page.waitForSelector('#dataHoraDistribuicaoProcesso');
            processos.push(await page.evaluate((adv) => {
                return {
                    dataDistribuicao    : $('#dataHoraDistribuicaoProcesso').text().replace(/(\r\n|\n|\r)/gm, ""),
                    numeroProcesso      : $('#numeroProcesso').text().replace(/(\r\n|\n|\r)/gm, ""),
                    advogado            : adv,
                    requerente          : $('#tablePartesPrincipais > tbody > tr:nth-child(1) > td.nomeParteEAdvogado').text().replace(/(\r\n|\n|\r)/gm, ""),
                    requerido           : $('#tablePartesPrincipais > tbody > tr:nth-child(2) > td.nomeParteEAdvogado').text().replace(/(\r\n|\n|\r)/gm, ""),
                    classe              : $('#classeProcesso').text().replace(/(\r\n|\n|\r)/gm, ""),
                    assunto             : $('#assuntoProcesso').text().replace(/(\r\n|\n|\r)/gm, ""),
                    valorAcao           : $('#valorAcaoProcesso').text().replace(/(\r\n|\n|\r)/gm, ""),
                    foro                : $('#foroProcesso').text().replace(/(\r\n|\n|\r)/gm, ""),
                    vara                : $('#varaProcesso').text().replace(/(\r\n|\n|\r)/gm, ""),
                }
            }, adv));
            // await page.waitForTimeout(1500);
        }

    }

    // await converter.json2csv(processos, (err, csv) => {
    //     fs.writeFileSync('todos.csv', csv);
    // })

    const parser = new Parser({});
    const csv = parser.parse(processos);
    await browser.close();
    bar1.stop();

    fs.writeFileSync('todos.csv', csv, 'latin1');

    // console.log(urlProcessos);
    console.log('concluido');

})();