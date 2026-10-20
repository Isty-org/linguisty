/** @spec spec://modules/page/FEAT-002-page-translation#acceptance */
for (let index = 0; index < 18; index++) {
  const paragraph = document.createElement('p');
  paragraph.textContent = '人工智能研究机器学习和知识表示。'.repeat(45) + index;
  document.getElementById('bulk').append(paragraph);
}
document.getElementById('long').textContent = '长段测试人工智能。'.repeat(1_300);
