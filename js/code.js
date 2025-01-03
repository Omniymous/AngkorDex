let starredTokens = JSON.parse(localStorage.getItem('starredTokens') || '[]');
let PAGE_SIZE = 250;
let currentPage = 1;
let allTokens = [];
const toggleStar = tokenId => {
  const index = starredTokens.indexOf(tokenId);
  if (index === -1) {
    starredTokens.push(tokenId);
  } else {
    starredTokens.splice(index, 1);
  }
  localStorage.setItem('starredTokens', JSON.stringify(starredTokens));
  const starBtns = document.querySelectorAll(`.star-btn[data-token-id="${tokenId}"]`);
  starBtns.forEach(btn => {
    if (index === -1) {
      btn.classList.add('starred');
      btn.textContent = '★';
    } else {
      btn.classList.remove('starred');
      btn.textContent = '☆';
    }
  });
  loadTokenPage();
  if (document.getElementById('watchlist-section').style.display !== 'none') {
    updateWatchlist();
  }
};
const showLoading = () => {
  const loading = document.querySelector('.data-loading');
  if (loading) loading.classList.add('visible');
};
const hideLoading = () => {
  const loading = document.querySelector('.data-loading');
  if (loading) loading.classList.remove('visible');
};
const fetchNews = async () => {
  try {
    const response = await axios.get('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=10');
    const news = response.data.Data;
    const container = document.getElementById('news-container');
    container.innerHTML = news.map(item => `
      <div class="news-item">
        <div class="news-content">
          <div class="news-title">
            <a href="${item.url}" target="_blank" rel="noopener noreferrer">
              ${item.title}
            </a>
          </div>
          <div class="news-meta">
            ${new Date(item.published_on * 1000).toLocaleString()} | ${item.source}
          </div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error fetching news:', error);
    const container = document.getElementById('news-container');
    container.innerHTML = `
      <div class="error-message">
        Failed to fetch news. Please check your internet connection and try again.
      </div>
    `;
  }
};
const updateTicker = async () => {
  if (!allTokens.length) return;
  const ticker = document.getElementById('price-ticker');
  if (!ticker) return;
  const tickerContent = allTokens.slice(0, 20).map(token => {
    const change = token.price_change_percentage_24h;
    const changeClass = change >= 0 ? 'green' : 'red';
    return `
      <div class="ticker-item">
        <img src="${token.image}" alt="${token.symbol}">
        ${token.symbol.toUpperCase()}
        <span class="${changeClass}">
          ${change >= 0 ? '↑' : '↓'}${Math.abs(change).toFixed(2)}%
        </span>
      </div>
    `;
  }).join('');
  ticker.innerHTML = tickerContent + tickerContent;
};
const fetchTokenData = async page => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 250,
        page,
        sparkline: true
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching token data:', error);
    return [];
  }
};
const loadTokenPage = async () => {
  if (!document.getElementById('token-container')) return;
  await new Promise(resolve => setTimeout(resolve, 2000));
  await updateTicker();
  try {
    const container = document.getElementById('token-container');
    if (allTokens.length === 0) {
      showLoading();
      allTokens = await fetchAllTokens();
    }
    const sortedTokens = [...allTokens].sort((a, b) => {
      const aStarred = starredTokens.includes(a.id);
      const bStarred = starredTokens.includes(b.id);
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      return 0;
    });
    container.innerHTML = `
      <h2 class="token-header">Token Listings</h2>
      <div class="token-list"></div>
    `;
    const tokenList = container.querySelector('.token-list');
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const currentPageTokens = sortedTokens.slice(start, end);
    currentPageTokens.forEach((token, idx) => {
      const row = document.createElement('div');
      row.className = 'token-row';
      row.innerHTML = createTokenRow(token, idx);
      row.setAttribute('data-token-id', token.id);
      tokenList.appendChild(row);
      renderSparkline(`sparkline-${token.id}`, token.sparkline_in_7d.price);
    });
    updatePagination();
    document.querySelectorAll('.token-row').forEach(row => {
      row.addEventListener('click', () => {
        const tokenId = row.dataset.tokenId;
        showTokenProfile(tokenId);
      });
    });
  } catch (error) {
    console.error('Error loading token page:', error);
  } finally {
    hideLoading();
  }
};
const createTokenRow = (token, index) => {
  const priceChange = token.price_change_percentage_24h;
  const changeClass = priceChange >= 0 ? 'green' : 'red';
  const changePrefix = priceChange >= 0 ? '↑' : '↓';
  const isStarred = starredTokens.includes(token.id);
  const starButton = `
    <button class="star-btn ${isStarred ? 'starred' : ''}" 
            data-token-id="${token.id}"
            onclick="event.stopPropagation(); toggleStar('${token.id}')">
      ${isStarred ? '★' : '☆'}
    </button>
  `;
  return `
    <div class="token-cell">
      <div class="token-info">
        ${starButton}
        <img src="${token.image}" alt="${token.name}" class="token-logo">
        <div>
          <div class="token-name">${token.name}</div>
          <div class="token-symbol">${token.symbol.toUpperCase()}</div>
        </div>
      </div>
    </div>
    <div class="token-cell token-price">
      <span>$${token.current_price?.toLocaleString() || '0.00'}</span>
      <div class="sparkline-container">
        <canvas id="sparkline-${token.id}"></canvas>
      </div>
    </div>
    <div class="token-cell ${changeClass}">
      <span class="change">
        <span class="arrow">${changePrefix}</span>
        ${Math.abs(priceChange?.toFixed(2) || 0)}%
      </span>
    </div>
    <div class="token-volume">Vol: $${(token.total_volume || 0).toLocaleString()}</div>
    <div class="token-mcap">MCap: $${(token.market_cap || 0).toLocaleString()}</div>
  `;
};
const updateWatchlist = () => {
  const container = document.getElementById('watchlist-tokens');
  if (starredTokens.length === 0) {
    container.innerHTML = `
      <div class="empty-watchlist">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <p>Your watchlist is empty</p>
        <p>Star some tokens to add them to your watchlist</p>
      </div>
    `;
    return;
  }
  container.innerHTML = '';
  starredTokens.forEach(tokenId => {
    const token = allTokens.find(token => token.id === tokenId);
    if (token) {
      const row = document.createElement('div');
      row.className = 'watchlist-token';
      row.innerHTML = `
        <div class="token-info">
          <img src="${token.image}" alt="${token.name}" class="token-logo">
          <div class="token-details">
            <div class="token-name">${token.name}</div>
            <div class="token-symbol">${token.symbol.toUpperCase()}</div>
          </div>
        </div>
        <div class="token-price">
          $${token.current_price?.toLocaleString() || '0.00'}
          <div class="sparkline-container">
            <canvas id="watchlist-sparkline-${token.id}"></canvas>
          </div>
        </div>
        <div class="token-change ${token.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}">
          ${token.price_change_percentage_24h >= 0 ? '↑' : '↓'}${Math.abs(token.price_change_percentage_24h?.toFixed(2) || 0)}%
        </div>
        <div class="token-volume">Vol: $${(token.total_volume || 0).toLocaleString()}</div>
        <div class="token-mcap">MCap: $${(token.market_cap || 0).toLocaleString()}</div>
        <button class="star-btn starred" onclick="event.stopPropagation(); toggleStar('${token.id}')">★</button>
      `;
      container.appendChild(row);
      renderSparkline(`watchlist-sparkline-${token.id}`, token.sparkline_in_7d.price);
    }
  });
};
const renderSparkline = (canvasId, data) => {
  const ctx = document.getElementById(canvasId).getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array.from({
        length: data.length
      }, (_, i) => i + 1),
      datasets: [{
        data,
        borderColor: 'rgba(0, 184, 148, 1)',
        borderWidth: 1,
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      scales: {
        x: {
          display: false
        },
        y: {
          display: false
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      },
      elements: {
        point: {
          radius: 0,
          hitRadius: 0,
          hoverRadius: 0
        }
      },
      maintainAspectRatio: false
    }
  });
};
const switchSection = sectionName => {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.setAttribute('data-active', 'false');
  });
  document.querySelector(`.nav-link[data-section="${sectionName}"]`).setAttribute('data-active', 'true');
  document.getElementById('token-container').style.display = 'none';
  document.getElementById('watchlist-section').style.display = 'none';
  document.getElementById('news-section').style.display = 'none';
  switch (sectionName) {
    case 'main':
      document.getElementById('token-container').style.display = 'block';
      break;
    case 'watchlist':
      document.getElementById('watchlist-section').style.display = 'block';
      updateWatchlist();
      break;
    case 'news':
      document.getElementById('news-section').style.display = 'block';
      fetchNews();
      break;
  }
};
const searchTokens = query => {
  const container = document.getElementById('token-container');
  const tokenList = container.querySelector('.token-list');
  tokenList.innerHTML = '';

  if (query.trim() === '') {
    loadTokenPage();
    return;
  }

  const filteredTokens = allTokens.filter(token => 
    token.name.toLowerCase().includes(query.toLowerCase()) || 
    token.symbol.toLowerCase().includes(query.toLowerCase())
  );

  if (filteredTokens.length === 0) {
    tokenList.innerHTML = `
      <div class="error-message">
        No tokens found matching the search query.
      </div>
    `;
    return;
  }

  filteredTokens.forEach((token, idx) => {
    const row = document.createElement('div');
    row.className = 'token-row';
    row.innerHTML = createTokenRow(token, idx);
    row.setAttribute('data-token-id', token.id);
    tokenList.appendChild(row);
    renderSparkline(`sparkline-${token.id}`, token.sparkline_in_7d.price);
  });
};

const handleSearch = debounce(() => {
  const query = document.querySelector('.search input').value;
  searchTokens(query);
}, 300);

document.querySelector('.search input').addEventListener('input', handleSearch);

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

async function fetchAllTokens() {
  let page = 1;
  while (true) {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 250,
          page,
          sparkline: true
        }
      });
      allTokens = [...allTokens, ...response.data];
      if (response.data.length < 250) break;
      page++;
    } catch (error) {
      console.error('Error fetching token data:', error);
      const container = document.getElementById('token-container');
      container.innerHTML = `
        <div class="error-message">
          Failed to fetch token data. Please check your internet connection and try again.
        </div>
      `;
      break;
    }
  }
  updatePagination();
  return allTokens;
}
function updatePagination() {
  const totalPages = Math.ceil(allTokens.length / PAGE_SIZE);
  const paginationContainer = document.querySelector('.pagination');
  if (paginationContainer) {
    let paginationHtml = '';
    for (let i = 1; i <= totalPages; i++) {
      paginationHtml += `
        <button class="pagination-item ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
      `;
    }
    paginationContainer.innerHTML = paginationHtml;
    document.querySelectorAll('.pagination-item').forEach(item => {
      item.addEventListener('click', () => {
        currentPage = parseInt(item.dataset.page);
        loadTokenPage();
      });
    });
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  const loadingScreen = document.getElementById('loading-screen');
  loadingScreen.style.opacity = '1';

  await fetchAllTokens();
  loadTokenPage();

  setTimeout(() => {
    loadingScreen.style.opacity = '0';
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 500);
  }, 2000);
});

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    switchSection(link.dataset.section);
  });
});

function showTokenProfile(tokenId) {
  const token = allTokens.find(token => token.id === tokenId);
  if (!token) return;

  const profile = document.querySelector('.token-profile');
  profile.querySelector('.token-logo').src = token.image;
  profile.querySelector('.token-name').textContent = token.name;
  profile.querySelector('.token-symbol').textContent = token.symbol.toUpperCase();
  
  profile.classList.add('show');
  document.querySelector('.overlay').classList.add('show');
}

function hideTokenProfile() {
  const profile = document.querySelector('.token-profile');
  profile.classList.remove('show');
  document.querySelector('.overlay').classList.remove('show');
}

document.querySelector('.token-profile .close-btn').addEventListener('click', hideTokenProfile);
document.querySelector('.overlay').addEventListener('click', hideTokenProfile);
