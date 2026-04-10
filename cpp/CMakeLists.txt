cmake_minimum_required(VERSION 3.16)
project(DAAProjectCore VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(ZLIB REQUIRED)

add_library(huffman STATIC
    src/huffman.cpp
)

add_library(image_optimizer STATIC
    src/image_optimizer.cpp
)

add_library(presentation_optimizer STATIC
    src/presentation_optimizer.cpp
)

target_link_libraries(presentation_optimizer PRIVATE
    image_optimizer
    ZLIB::ZLIB
)

target_include_directories(huffman PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_include_directories(image_optimizer PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_include_directories(presentation_optimizer PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)
