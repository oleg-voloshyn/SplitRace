import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

function Notifications() {
  const [data, setData] = useState({ notifications: [], unread_count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .notifications()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function markAllRead() {
    await api.readAllNotifications();
    setData(await api.notifications());
  }

  return (
    <div>
      <div className="sr-page-heading">
        <h2>Notifications</h2>
        {data.unread_count > 0 && (
          <button type="button" className="sr-share-btn" onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      {loading && <p>Loading...</p>}
      {!loading && data.notifications.length === 0 && <p className="sr-card">No notifications yet.</p>}

      <div className="sr-feed-list">
        {data.notifications.map((notification) => (
          <div key={notification.id} className={`sr-card sr-notification ${notification.read_at ? '' : 'unread'}`}>
            <div>
              <strong>{notification.title}</strong>
              {notification.body && <p className="sr-feed-body">{notification.body}</p>}
              <small className="sr-feed-date">{new Date(notification.created_at).toLocaleString()}</small>
            </div>
            {notification.tournament && (
              <Link className="sr-share-btn" to={`/tournaments/${notification.tournament.slug}`}>
                Open
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Notifications;
