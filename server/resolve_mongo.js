import dns from 'dns';
import { promisify } from 'util';

const resolveSrv = promisify(dns.resolveSrv);
const resolveTxt = promisify(dns.resolveTxt);

async function resolveMongoSrv(srvUrl) {
  try {
    dns.setServers(['8.8.8.8', '8.8.4.4']); // Use Google DNS to bypass local DNS issues
    
    const url = new URL(srvUrl);
    const hostname = url.hostname;
    
    console.log(`Resolving SRV for _mongodb._tcp.${hostname}...`);
    const srvRecords = await resolveSrv(`_mongodb._tcp.${hostname}`);
    
    console.log(`Resolving TXT for ${hostname}...`);
    let txtRecords = [];
    try {
      txtRecords = await resolveTxt(`${hostname}`);
    } catch (e) {
      console.log('No TXT records found or error reading them.');
    }

    const hosts = srvRecords.map(record => `${record.name}:${record.port}`).join(',');
    
    let options = 'ssl=true';
    if (txtRecords.length > 0) {
        options += '&' + txtRecords.join('');
    }
    
    // Add authSource=admin
    options += '&authSource=admin';

    const directUrl = `mongodb://${url.username}:${url.password}@${hosts}/${url.pathname.substring(1)}?${options}`;
    console.log('\nResolved Direct URL:');
    console.log(directUrl);
  } catch (error) {
    console.error('Error resolving:', error);
  }
}

const url = 'mongodb+srv://chatapp:chatapp123@cluster0.tfu4vup.mongodb.net/chat-app';
resolveMongoSrv(url);
