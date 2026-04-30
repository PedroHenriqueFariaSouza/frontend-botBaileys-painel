# Vite no Projeto

## Papel no projeto

Vite e usado como bundler e servidor de desenvolvimento. Ele oferece inicializacao rapida e HMR para iteracao eficiente no frontend.

## Onde aparece no codigo

- vite.config.ts para configuracoes de build e dev
- package.json nos scripts dev, build, preview e prod

## Importancia pratica

- Ciclo de desenvolvimento mais rapido
- Build otimizado para entrega em producao
- Uso padronizado de variaveis de ambiente com prefixo VITE_

## Decisoes relevantes

- Variaveis de ambiente acessadas via import.meta.env
- Pipeline simples para build e preview local
