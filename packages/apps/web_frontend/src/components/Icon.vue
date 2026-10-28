<script setup lang="ts">
// Bootstrap Icons glyph (https://icons.getbootstrap.com/). `name` is the Bootstrap Icons name without the `bi-` prefix.
// The name `heidrun-goat-only` is the icon of Heidrun Code, the goat: its paths are the ones of `data/images/heidrun_icon_goat_only.svg`,
// drawn in the way of the Bootstrap Icons, so it takes the color and the size of the text around it.
defineProps<{ name: string }>();
</script>

<template>
  <svg
    v-if="name === 'heidrun-goat-only'"
    class="bi bi-heidrun-goat-only"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path d="M9.506 8.064L9.506 6.676C9.229 0.295 3.68 -0.815 1.182 3.902C3.402 1.127 6.454 1.959 7.287 6.954L7.287 8.064Z" />
    <path d="M7.12 7.894L3.006 6.029L5.233 9.621Z" />
    <path
      fill-rule="evenodd"
      d="M14.778 10.838Q15.055 9.451 13.391 8.341L10.061 5.844Q7.564 5.011 5.899 6.954L3.957 11.948L4.512 14.723L7.287 14.723L8.396 12.225Q10.616 12.78 12.558 12.225Q14.5 12.225 14.778 10.838ZM10.561 8.896a0.61 0.61 0 1 0 1.221 0a0.61 0.61 0 1 0 -1.221 0z"
    />
    <path d="M11.448 11.393L11.448 12.503Q11.31 13.89 12.281 15Q13.252 13.89 13.113 12.225L13.113 11.393Z" />
  </svg>
  <!--
    VS Code Codicons file-submodule: https://github.com/microsoft/vscode-codicons
    Copyright (c) Microsoft Corporation. MIT License.
    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
    documentation files (the "Software"), to deal in the Software without restriction, including without limitation
    the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
    and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
    The above copyright notice and this permission notice shall be included in all copies or substantial portions
    of the Software.
    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
    TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
    THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
    CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
    DEALINGS IN THE SOFTWARE.
  -->
  <svg
    v-else-if="name === 'file-submodule'"
    class="bi bi-file-submodule"
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="currentColor"
    viewBox="0 0 16 16"
    aria-hidden="true"
  >
    <path d="M3.5 3C2.67157 3 2 3.67157 2 4.5V5H5.08579C5.21839 5 5.34557 4.94732 5.43934 4.85355L6.29289 4L5.43934 3.14645C5.34557 3.05268 5.21839 3 5.08579 3H3.5ZM1 4.44118C1 4.4252 1.00075 4.4094 1.00221 4.39381C1.05785 3.06235 2.15486 2 3.5 2H5.08579C5.48361 2 5.86514 2.15804 6.14645 2.43934L7.20711 3.5H10.5C11.8807 3.5 13 4.61929 13 6V9.5C13 10.8807 11.8807 12 10.5 12H3.5C2.11929 12 1 10.8807 1 9.5V4.44118ZM7.20711 4.5L6.14645 5.56066C5.86514 5.84196 5.48361 6 5.08579 6H2V9.5C2 10.3284 2.67157 11 3.5 11H10.5C11.3284 11 12 10.3284 12 9.5V6C12 5.17157 11.3284 4.5 10.5 4.5H7.20711ZM14.0002 6C14.6074 6.4561 15.0002 7.18227 15.0002 8.00018V9.50018C15.0002 11.9855 12.9855 14.0002 10.5002 14.0002H5.50018C4.68227 14.0002 3.9561 13.6074 3.5 13.0002H10.5002C12.4332 13.0002 14.0002 11.4332 14.0002 9.50018V6Z" />
  </svg>
  <i v-else class="bi" :class="`bi-${name}`" aria-hidden="true"></i>
</template>

<style scoped>
.bi-heidrun-goat-only, .bi-file-submodule { vertical-align: -0.125em; }
</style>
