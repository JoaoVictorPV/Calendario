@echo off
echo Iniciando Clepsidra - Agenda On-Line...

if not exist node_modules (
    echo Instalando dependencias...
    call npm install
)

echo Iniciando servidor de desenvolvimento...
start npm run dev

echo Aguardando servidor iniciar...
timeout /t 5 /nobreak >nul

echo Abrindo no Chrome...
start chrome http://localhost:5173

echo.
echo Clepsidra esta rodando! Nao feche esta janela se quiser manter o servidor ativo.
