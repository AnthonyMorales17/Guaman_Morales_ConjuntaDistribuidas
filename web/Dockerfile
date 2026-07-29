FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN rm -f /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/package.json \
          /usr/share/nginx/html/package-lock.json
EXPOSE 80
