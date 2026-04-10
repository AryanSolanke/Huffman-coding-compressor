@echo off
setlocal

set SRC=src
set INCLUDE=include
set BUILD=build

echo Building C++ Core...

if not exist %BUILD% mkdir %BUILD%

g++ -std=c++14 -O2 -c %SRC%\huffman.cpp -I%INCLUDE% -o %BUILD%\huffman.o
if errorlevel 1 goto error

g++ -std=c++14 -O2 -c %SRC%\image_optimizer.cpp -I%INCLUDE% -o %BUILD%\image_optimizer.o
if errorlevel 1 goto error

g++ -std=c++14 -O2 -c %SRC%\presentation_optimizer.cpp -I%INCLUDE% -o %BUILD%\presentation_optimizer.o
if errorlevel 1 goto error

ar rcs %BUILD%\libhuffman.a %BUILD%\huffman.o
ar rcs %BUILD%\libimage_optimizer.a %BUILD%\image_optimizer.o
ar rcs %BUILD%\libpresentation_optimizer.a %BUILD%\presentation_optimizer.o

echo.
echo Build complete! Libraries in %BUILD%\
dir %BUILD%\*.a
goto end

:error
echo.
echo Build failed!
exit /b 1

:end
